import { access } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { ChainContext, Condition, ChainVariable } from "./types.js";

export function renderTemplate(
  template: string,
  context: ChainContext,
  variables: ChainVariable[] = [],
): string {
  let result = template.replace(/\{input\}/g, context.input);
  result = result.replace(/\{iteration\}/g, String(context.iteration + 1));
  result = result.replace(/\{lastResult\}/g, context.lastResult);

  for (const [key, value] of Object.entries(context.results)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }

  for (const v of variables) {
    result = result.replace(new RegExp(`\\{${v.name}\\}`, "g"), v.value);
  }

  return result;
}

export function evaluateCondition(
  condition: Condition | undefined,
  context: ChainContext,
): boolean {
  switch (condition) {
    case undefined:
    case "always":
      return true;
    case "on_success":
      return context.errors.length === 0;
    case "on_error":
      return context.errors.length > 0;
    default:
      return true;
  }
}

export async function resolveChainPath(
  name: string,
  chainDir: string,
): Promise<string | null> {
  const ext = name.endsWith(".md") ? "" : ".md";
  const paths = [join(chainDir, `${name}${ext}`)];

  const globalDir = join(homedir(), ".config", "opencode", "chains");
  paths.push(join(globalDir, `${name}${ext}`));

  for (const p of paths) {
    try {
      await access(p);
      return p;
    } catch {
      continue;
    }
  }

  return null;
}
