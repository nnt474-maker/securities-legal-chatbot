import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * Extract the actual answer text from whatever shape n8n returns.
 *
 * Supported formats:
 *   { output, answer_text, text, message, response }   – single object
 *   [ { output, text, … }, … ]                         – array (take first item)
 *   Plain text (not JSON)
 *
 * Returns null when the shape is not recognised (caller will log + surface error).
 */
function extractOutput(parsed: unknown): string | null {
  // ── Array: recurse on first element ────────────────────────────────────────
  if (Array.isArray(parsed)) {
    return parsed.length > 0 ? extractOutput(parsed[0]) : null;
  }

  // ── Must be a plain object from here ───────────────────────────────────────
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  // Detect n8n "Respond immediately" acknowledgement – NOT a real answer
  if (obj.executionStarted === true || obj.executionId !== undefined) {
    return null; // signal to caller that this is an ack, not an answer
  }

  // Walk known field names in priority order
  for (const key of ["output", "answer_text", "text", "message", "response"]) {
    const val = obj[key];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
  }

  return null;
}

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_URL is not configured" },
      { status: 500 }
    );
  }

  let body: { chatInput: string; sessionId: string; lang: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { chatInput, sessionId, lang } = body;
  if (!chatInput || !sessionId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  let n8nResponse: Response;
  try {
    n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatInput, sessionId, lang: lang ?? "vi" }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    console.error("[/api/chat] n8n fetch error:", err);
    return NextResponse.json(
      { error: "Failed to reach n8n webhook" },
      { status: 502 }
    );
  }

  if (!n8nResponse.ok) {
    return NextResponse.json(
      { error: `n8n returned ${n8nResponse.status}` },
      { status: 502 }
    );
  }

  const raw = await n8nResponse.text();

  // ── Parse response ──────────────────────────────────────────────────────────
  let output: string;

  // 1. Try plain text first (no JSON braces/brackets at all)
  if (!raw.trimStart().startsWith("{") && !raw.trimStart().startsWith("[")) {
    output = raw.trim();
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Malformed JSON → use raw text
      output = raw.trim();
      return NextResponse.json({ output });
    }

    const extracted = extractOutput(parsed);

    if (extracted !== null) {
      output = extracted;
    } else {
      // Could not find a known answer field — log full payload for debugging
      console.error(
        "[/api/chat] ⚠ Could not extract answer from n8n response.\n" +
        "Raw payload:", JSON.stringify(parsed, null, 2)
      );

      // If it looks like an executionStarted ack, return a specific hint
      const obj = parsed as Record<string, unknown>;
      if (
        typeof obj === "object" && obj !== null &&
        (obj.executionStarted === true || obj.executionId !== undefined)
      ) {
        return NextResponse.json(
          {
            error:
              "n8n webhook đang ở chế độ 'Respond Immediately'. " +
              "Vào n8n → Webhook node → đổi 'Response Mode' thành " +
              "'When Last Node Finishes' rồi save workflow.",
          },
          { status: 502 }
        );
      }

      // Generic fallback: stringify so the UI shows something debuggable
      output = `[Debug] n8n trả về dữ liệu không nhận dạng được:\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
    }
  }

  return NextResponse.json({ output });
}
