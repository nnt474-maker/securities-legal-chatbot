import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

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

  // Try to parse as JSON; otherwise treat as plain text
  let output: string;
  try {
    const parsed = JSON.parse(raw);
    // Support {output: "..."}, {answer_text: "..."}, or first element of array
    if (Array.isArray(parsed)) {
      const first = parsed[0];
      output =
        first?.output ?? first?.answer_text ?? first?.text ?? JSON.stringify(first);
    } else {
      output =
        parsed?.output ?? parsed?.answer_text ?? parsed?.text ?? JSON.stringify(parsed);
    }
  } catch {
    output = raw.trim();
  }

  return NextResponse.json({ output });
}
