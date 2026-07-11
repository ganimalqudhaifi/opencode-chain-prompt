import { type Plugin, tool } from "@opencode-ai/plugin";
import { loadChain, listChains } from "./chain-loader.js";
import { executeChain } from "./chain-executor.js";

const plugin: Plugin = async ({ client }) => {
  const chainDir = ".opencode/chains";

  return {
    tool: {
      chain_start: tool({
        description:
          "Run a chain prompting workflow. " +
          "Executes sequence of prompt steps sequentially via SDK, " +
          "each with its own agent/model. Supports looping and conditional branching. " +
          "Use when the user wants a multi-step automated workflow like generate → validate → commit.",

        args: {
          name: tool.schema.string(),
          input: tool.schema.string(),
        },

        async execute(args: { name: string; input: string }) {
          const chain = await loadChain(args.name, chainDir);
          const result = await executeChain(chain, {
            input: args.input,
            sdkClient: client,
            chainDir,
          });

          if (!result.success) {
            return `Chain "${args.name}" failed at iteration ${result.context.iteration + 1}.\nError: ${result.error}`;
          }

          if (chain.loop > 1) {
            return (
              `Chain "${args.name}" completed (${chain.loop} iterations).\n` +
              formatSummary(result.context)
            );
          }

          return `Chain "${args.name}" completed.\n` + formatSummary(result.context);
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

function formatSummary(context: {
  results: Record<string, string>;
  errors: string[];
  lastResult: string;
}): string {
  const parts: string[] = [];
  for (const [id, result] of Object.entries(context.results)) {
    const preview = result.length > 200 ? result.slice(0, 200) + "..." : result;
    parts.push(`[${id}]: ${preview}`);
  }
  if (context.errors.length > 0) {
    parts.push(`\nErrors: ${context.errors.length}`);
    for (const err of context.errors.slice(0, 3)) {
      parts.push(`  - ${err}`);
    }
  }
  return parts.join("\n");
}

export default plugin;
