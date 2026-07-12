export const activeChains = new Map<string, any>();

function extractTextFromParts(parts: any[]): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p: any) => p.type === "text")
    .map((p: any) => p.text)
    .join("\n");
}

export async function findLastAssistantResponse(
  client: any,
  sessionID: string,
): Promise<string> {
  try {
    const resp = await client.session.messages({
      path: { id: sessionID },
      query: { limit: 5 },
    });

    const raw = resp.data || resp;
    const messages = Array.isArray(raw) ? raw : raw.messages || [];

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "assistant" && !msg.summary) {
        const detailResp = await client.session.message({
          path: { id: sessionID, messageID: msg.id },
        });
        const detail = detailResp.data || detailResp;
        const parts = detail.parts || [];
        const text = extractTextFromParts(parts);
        if (text) return text;
      }
    }
  } catch {
    // Ignore errors reading messages
  }
  return "";
}

export function formatSummary(context: {
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
