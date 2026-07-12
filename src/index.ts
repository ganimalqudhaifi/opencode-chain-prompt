import { type Plugin, tool } from "@opencode-ai/plugin";
import { loadChain, listChains } from "./chain-loader.js";
import { renderTemplate } from "./utils.js";
import { activeChains, findLastAssistantResponse, formatSummary } from "./chain-executor.js";

const plugin: Plugin = async ({ client }) => {
  const chainDir = ".opencode/chains";

  return {
    config: async (cfg) => {
      const commands = (cfg as Record<string, any>).command ?? {};
      commands.chain = {
        description:
          "Run a chain prompting workflow. " +
          "Usage: /chain <name> <input>. " +
          "Example: /chain generate-component button",
        template: [
          "The user wants to run a chain prompting workflow.",
          "",
          "Arguments: $ARGUMENTS",
          "",
          "If $1 is not provided, call chain_list to show available chains.",
          "If $1 is provided, call chain_start with name=$1 and input=$2.",
          "After execution, report the results back to the user.",
        ].join("\n"),
      };
      (cfg as Record<string, any>).command = commands;
    },

    event: async ({ event }) => {
      if (event.type !== "session.idle") return;

      const sessionID = event.properties.sessionID;
      const progress = activeChains.get(sessionID);
      if (!progress) return;

      const chain = progress.chain;
      const step = chain.steps[progress.stepIndex];

      if (progress.stepIndex > 0 && step) {
        const resultText = await findLastAssistantResponse(client, sessionID);
        if (resultText) {
          progress.context.results[step.id] = resultText;
          progress.context.lastResult = resultText;
        }
      }

      progress.stepIndex++;

      if (progress.stepIndex >= chain.steps.length) {
        activeChains.delete(sessionID);
        const summary = formatSummary(progress.context);
        try {
          await client.session.promptAsync({
            path: { id: sessionID },
            body: {
              parts: [{
                type: "text",
                text: `Chain "${chain.name}" completed.\n${summary}`,
              }],
            },
          });
        } catch {
          // Ignore completion injection errors
        }
        return;
      }

      const nextStep = chain.steps[progress.stepIndex];
      const nextPrompt = renderTemplate(nextStep.prompt, progress.context, []);

      try {
        await client.session.promptAsync({
          path: { id: sessionID },
          body: {
            parts: [{
              type: "text",
              text: nextPrompt,
            }],
          },
        });
      } catch (err: any) {
        activeChains.delete(sessionID);
        progress.context.errors.push(
          `Step "${nextStep.id}" failed to inject: ${err.message || err}`,
        );
      }
    },

    tool: {
      chain_start: tool({
        description:
          "Run a chain prompting workflow. " +
          "Executes sequence of prompt steps sequentially as subtasks in the current session. " +
          "Supports looping and conditional branching. " +
          "Use when the user wants a multi-step automated workflow like generate → validate → commit.",

        args: {
          name: tool.schema.string(),
          input: tool.schema.string(),
        },

        async execute(
          args: { name: string; input: string },
          context: { sessionID: string; agent: string },
        ) {
          const chain = await loadChain(args.name, chainDir);

          if (chain.steps.length === 0) {
            return `Chain "${args.name}" has no steps.`;
          }

          const ctx = {
            input: args.input,
            iteration: 0,
            results: {} as Record<string, string>,
            lastResult: "",
            errors: [] as string[],
          };

          activeChains.set(context.sessionID, {
            chain,
            context: ctx,
            stepIndex: 0,
            opts: {
              input: args.input,
              agent: context.agent,
            },
          });

          const firstStep = chain.steps[0];
          const agentName = firstStep.agent || chain.default_agent || context.agent;

          return (
            `Chain "${args.name}" started with step "${firstStep.id}" (agent: ${agentName}).\n` +
            `Progress will appear in the conversation step by step.`
          );
        },
      }),

      chain_list: tool({
        description: "List all available chain definitions.",

        args: {
          name: tool.schema.string().optional(),
        },

        async execute() {
          const chains = await listChains(chainDir);
          if (chains.length === 0) {
            return (
              "No chain definitions found.\n" +
              "Create .md files in .opencode/chains/ or ~/.config/opencode/chains/"
            );
          }
          return (
            "Available chains:\n" +
            chains.map((name) => `  - ${name}`).join("\n") +
            "\n\nRun with chain_start tool or /chain <name> <input>"
          );
        },
      }),
    },
  };
};

export default plugin;
