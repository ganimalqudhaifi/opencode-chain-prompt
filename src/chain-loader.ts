import { readFile, readdir } from "fs/promises";
import { join, basename, extname } from "path";
import { homedir } from "os";
import matter from "gray-matter";
import type { ChainDefinition, ChainStep, Condition } from "./types.js";
import { resolveChainPath } from "./utils.js";

const CONDITION_VALUES: string[] = ["always", "on_success", "on_error"];

function validateCondition(val: unknown): Condition {
  if (typeof val === "string" && CONDITION_VALUES.includes(val)) {
    return val as Condition;
  }
  return "always";
}

function validateSteps(raw: unknown): ChainStep[] {
  if (!Array.isArray(raw)) {
    throw new Error("steps must be an array");
  }

  return raw.map((step: Record<string, unknown>, i: number) => {
    if (!step.id || typeof step.id !== "string") {
      throw new Error(`step[${i}]: id is required and must be a string`);
    }
    if (!step.prompt || typeof step.prompt !== "string") {
      throw new Error(`step[${i}]: prompt is required and must be a string`);
    }
    if (!step.agent || typeof step.agent !== "string") {
      throw new Error(`step[${i}]: agent is required and must be a string`);
    }

    return {
      id: step.id,
      agent: step.agent,
      prompt: step.prompt,
      condition: validateCondition(step.condition),
    };
  });
}

export async function loadChain(name: string, chainDir?: string): Promise<ChainDefinition> {
  const dir = chainDir || join(process.cwd(), ".opencode", "chains");
  const path = await resolveChainPath(name, dir);

  if (!path) {
    const globalDir = join(homedir(), ".config", "opencode", "chains");
    throw new Error(
      `Chain "${name}" not found.\n` +
        `  Searched:\n` +
        `    - ${join(dir, name)}.md\n` +
        `    - ${join(globalDir, name)}.md\n` +
        `  Run chain_list to see available chains.`,
    );
  }

  const content = await readFile(path, "utf-8");
  const parsed = matter(content);

  if (!parsed.data.name && typeof parsed.data.name !== "string") {
    parsed.data.name = basename(path, extname(path));
  }

  const def: ChainDefinition = {
    name: parsed.data.name,
    description: parsed.data.description,
    default_model: parsed.data.default_model || "anthropic/claude-sonnet-4-6",
    loop: typeof parsed.data.loop === "number" ? parsed.data.loop : 1,
    steps: validateSteps(parsed.data.steps),
  };

  if (def.steps.length === 0) {
    throw new Error(`Chain "${def.name}" has no steps defined`);
  }

  return def;
}

export async function listChains(chainDir?: string): Promise<string[]> {
  const dir = chainDir || join(process.cwd(), ".opencode", "chains");
  const globalDir = join(homedir(), ".config", "opencode", "chains");
  const chains: Set<string> = new Set();

  for (const d of [dir, globalDir]) {
    try {
      const entries = await readdir(d);
      for (const entry of entries) {
        if (entry.endsWith(".md")) {
          chains.add(entry.slice(0, -3));
        }
      }
    } catch {
      continue;
    }
  }

  return Array.from(chains).sort();
}
