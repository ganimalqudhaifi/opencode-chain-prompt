import { readFile, access } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import matter from "gray-matter";
import type { ChainDefinition, ChainContext, ChainResult, AgentConfig } from "./types.js";
import { renderTemplate, evaluateCondition } from "./utils.js";

interface ExecutorOptions {
  input: string;
  sdkClient: any;
  chainDir?: string;
  variables?: Record<string, string>;
  stepTimeout?: number;
}

async function resolveAgent(
  agentName: string,
  chainDir: string,
): Promise<AgentConfig> {
  const searchPaths = [
    join(chainDir, "..", "agents", `${agentName}.md`),
    join(chainDir, "..", "agent", `${agentName}.md`),
    join(homedir(), ".config", "opencode", "agents", `${agentName}.md`),
    join(homedir(), ".config", "opencode", "agent", `${agentName}.md`),
  ];

  const config: AgentConfig = {};

  for (const p of searchPaths) {
    try {
      await access(p);
      const content = await readFile(p, "utf-8");
      const parsed = matter(content);

      if (parsed.data.model) config.model = parsed.data.model;
      if (parsed.content.trim()) config.system = parsed.content.trim();
      if (parsed.data.permission) config.permission = parsed.data.permission;
      break;
    } catch {
      continue;
    }
  }

  return config;
}

function buildTools(permission?: Record<string, string>): Record<string, boolean> | undefined {
  if (!permission) return undefined;
  const tools: Record<string, boolean> = {};
  if (permission.edit !== "deny") tools.edit = true;
  if (permission.bash !== "deny") tools.bash = true;
  if (permission.read !== "deny") tools.search = true;
  return Object.keys(tools).length > 0 ? tools : undefined;
}

function parseModelID(full: string): { providerID: string; modelID: string } {
  const idx = full.indexOf("/");
  if (idx === -1) return { providerID: "anthropic", modelID: full };
  return {
    providerID: full.slice(0, idx),
    modelID: full.slice(idx + 1),
  };
}

function extractText(response: any): string {
  if (!response) return "";
  if (typeof response === "string") return response;

  const data = response.data || response;

  if (data?.parts && Array.isArray(data.parts)) {
    return data.parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("\n");
  }

  if (data?.info) {
    return extractText(data);
  }

  if (data?.text) return data.text;

  return JSON.stringify(data);
}

async function callStep(
  client: any,
  prompt: string,
  model: string,
  system: string,
  permission?: Record<string, string>,
): Promise<string> {
  const { providerID, modelID } = parseModelID(model);

  const sessionResp = await client.session.create({ throwOnError: true });
  const sessionID = sessionResp.id;

  const msgResp = await client.session.prompt({
    throwOnError: true,
    path: { id: sessionID },
    body: {
      parts: [{ type: "text", text: prompt }],
      model: { providerID, modelID },
      system,
      tools: buildTools(permission),
    },
  });

  return extractText(msgResp);
}

export async function executeChain(
  chain: ChainDefinition,
  opts: ExecutorOptions,
): Promise<ChainResult> {
  const chainDir = opts.chainDir || ".opencode/chains";
  const context: ChainContext = {
    input: opts.input,
    iteration: 0,
    results: {},
    lastResult: "",
    errors: [],
  };

  const variables = opts.variables
    ? Object.entries(opts.variables).map(([name, value]) => ({ name, value }))
    : [];

  for (let iter = 0; iter < chain.loop; iter++) {
    context.iteration = iter;

    for (const step of chain.steps) {
      if (!evaluateCondition(step.condition, context)) {
        continue;
      }

      const agent = await resolveAgent(step.agent, chainDir);
      const model = agent.model || chain.default_model;
      const prompt = renderTemplate(step.prompt, context, variables);
      const system =
        agent.system ||
        `You are executing step "${step.id}" of chain "${chain.name}". ` +
          `Iteration ${iter + 1}/${chain.loop}. Focus only on this step.`;

      try {
        const resultText = await callStep(
          opts.sdkClient,
          prompt,
          model,
          system,
          agent.permission,
        );

        context.results[step.id] = resultText;
        context.lastResult = resultText;
      } catch (err: any) {
        const errorMsg = `Step "${step.id}" (iter ${iter + 1}) failed: ${err.message || err}`;
        context.errors.push(errorMsg);
        context.lastResult = `ERROR: ${errorMsg}`;

        if (!step.condition || step.condition === "always") {
          return {
            success: false,
            context,
            error: errorMsg,
          };
        }
      }
    }
  }

  return { success: context.errors.length === 0, context };
}
