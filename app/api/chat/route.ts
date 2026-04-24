import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// ─── helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Walk the runData object from a finished n8n execution and return the first
 * string value we can find under any output-like field.
 *
 * Priority:
 *   1. Node named exactly "Respond (final)"
 *   2. Any node whose name contains "respond" or "output" (case-insensitive)
 *   3. The very last node in runData
 *
 * Within each node we look at:
 *   node[0].data.main[0][0].json.{output|answer_text|text|message|response}
 */
function extractFromRunData(
  runData: Record<string, unknown>
): string | null {
  const nodeNames = Object.keys(runData);
  if (nodeNames.length === 0) return null;

  // Ranked candidate list
  const candidates: string[] = [];

  const exact = nodeNames.find((n) => n === "Respond (final)");
  if (exact) candidates.push(exact);

  const fuzzy = nodeNames.filter(
    (n) =>
      n !== exact &&
      (n.toLowerCase().includes("respond") ||
        n.toLowerCase().includes("output") ||
        n.toLowerCase().includes("answer"))
  );
  candidates.push(...fuzzy);

  // Fallback: last node
  const last = nodeNames[nodeNames.length - 1];
  if (!candidates.includes(last)) candidates.push(last);

  for (const name of candidates) {
    const result = pickJsonFromNodeRuns(
      runData[name] as unknown[]
    );
    if (result !== null) return result;
  }
  return null;
}

function pickJsonFromNodeRuns(runs: unknown[]): string | null {
  if (!Array.isArray(runs) || runs.length === 0) return null;

  // Each run: { data: { main: [ [ { json: {...} } ] ] } }
  for (const run of runs) {
    const r = run as Record<string, unknown>;
    try {
      const main = (r?.data as Record<string, unknown>)
        ?.main as unknown[][];
      if (!Array.isArray(main)) continue;

      for (const lane of main) {
        if (!Array.isArray(lane)) continue;
        for (const item of lane) {
          const json = (item as Record<string, unknown>)
            ?.json as Record<string, unknown>;
          if (!json) continue;

          for (const key of [
            "output",
            "answer_text",
            "text",
            "message",
            "response",
          ]) {
            const val = json[key];
            if (typeof val === "string" && val.trim().length > 0)
              return val.trim();
          }
        }
      }
    } catch {
      /* keep looking */
    }
  }
  return null;
}

// ─── main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const apiKey     = process.env.N8N_API_KEY;
  const baseUrl    = process.env.N8N_BASE_URL ?? "https://n8n.phs.vn";

  if (!webhookUrl) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_URL is not configured" },
      { status: 500 }
    );
  }
  if (!apiKey) {
    return NextResponse.json(
      { error: "N8N_API_KEY is not configured" },
      { status: 500 }
    );
  }

  // ── 1. Parse incoming request ──────────────────────────────────────────────
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

  // ── 2. Trigger n8n chatTrigger webhook ────────────────────────────────────
  let triggerRes: Response;
  try {
    triggerRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatInput, sessionId, lang: lang ?? "vi" }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error("[/api/chat] webhook trigger error:", err);
    return NextResponse.json(
      { error: "Failed to reach n8n webhook" },
      { status: 502 }
    );
  }

  if (!triggerRes.ok) {
    return NextResponse.json(
      { error: `n8n webhook returned HTTP ${triggerRes.status}` },
      { status: 502 }
    );
  }

  // ── 3. Parse trigger response to get executionId ──────────────────────────
  let executionId: string | null = null;

  const triggerRaw = await triggerRes.text();
  try {
    const triggerJson = JSON.parse(triggerRaw) as Record<string, unknown>;

    // Happy path: async chat trigger returns { executionId: "..." }
    if (typeof triggerJson.executionId === "string") {
      executionId = triggerJson.executionId;
    } else if (typeof triggerJson.executionId === "number") {
      executionId = String(triggerJson.executionId);
    }

    // If n8n returned the answer synchronously (Response Mode = "last node")
    // detect it and short-circuit — no polling needed
    if (executionId === null) {
      for (const key of ["output", "answer_text", "text", "message", "response"]) {
        const val = triggerJson[key];
        if (typeof val === "string" && val.trim().length > 0) {
          console.log("[/api/chat] Got synchronous answer from webhook");
          return NextResponse.json({ output: val.trim() });
        }
      }
    }
  } catch {
    // Not JSON → treat as plain-text synchronous answer
    if (triggerRaw.trim().length > 0) {
      return NextResponse.json({ output: triggerRaw.trim() });
    }
  }

  if (!executionId) {
    console.error(
      "[/api/chat] Could not find executionId in trigger response:",
      triggerRaw
    );
    return NextResponse.json(
      { error: "n8n did not return an executionId. Raw: " + triggerRaw.slice(0, 200) },
      { status: 502 }
    );
  }

  // ── 4. Poll execution API until finished ─────────────────────────────────
  const POLL_INTERVAL_MS = 1_000;
  const TIMEOUT_MS       = 60_000;
  const deadline         = Date.now() + TIMEOUT_MS;
  const execUrl = `${baseUrl}/api/v1/executions/${executionId}`;

  console.log(`[/api/chat] Polling execution ${executionId} …`);

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    let pollRes: Response;
    try {
      pollRes = await fetch(execUrl, {
        headers: {
          "X-N8N-API-KEY": apiKey,
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      console.warn("[/api/chat] Poll fetch error (will retry):", err);
      continue;
    }

    if (pollRes.status === 404) {
      // Execution might not be persisted yet; retry
      continue;
    }
    if (!pollRes.ok) {
      console.error(`[/api/chat] Poll returned HTTP ${pollRes.status}`);
      return NextResponse.json(
        { error: `n8n execution API returned HTTP ${pollRes.status}` },
        { status: 502 }
      );
    }

    let exec: Record<string, unknown>;
    try {
      exec = (await pollRes.json()) as Record<string, unknown>;
    } catch {
      continue; // malformed JSON, retry
    }

    // n8n marks completion with finished:true or status:"success"/"error"
    const finished =
      exec.finished === true ||
      exec.status === "success" ||
      exec.status === "error" ||
      exec.status === "crashed";

    if (!finished) continue;

    // ── 5. Extract answer from run data ────────────────────────────────────
    if (exec.status === "error" || exec.status === "crashed") {
      console.error("[/api/chat] n8n execution failed:", JSON.stringify(exec));
      return NextResponse.json(
        { error: "n8n workflow execution failed. Check n8n logs." },
        { status: 502 }
      );
    }

    try {
      const runData = (
        (exec.data as Record<string, unknown>)
          ?.resultData as Record<string, unknown>
      )?.runData as Record<string, unknown>;

      if (runData) {
        const answer = extractFromRunData(runData);
        if (answer) {
          console.log(`[/api/chat] Answer extracted from execution ${executionId}`);
          return NextResponse.json({ output: answer });
        }
      }
    } catch (e) {
      console.error("[/api/chat] Error parsing runData:", e);
    }

    // Could not extract — log the full payload for debugging
    console.error(
      "[/api/chat] ⚠ Execution finished but no answer found. Full exec data:\n",
      JSON.stringify(exec, null, 2)
    );
    return NextResponse.json(
      {
        error:
          "Workflow finished but no answer was found. " +
          "Check that your final node outputs to a field named: " +
          "output / answer_text / text / message / response",
      },
      { status: 502 }
    );
  }

  // Timed out
  console.error(`[/api/chat] Timed out waiting for execution ${executionId}`);
  return NextResponse.json(
    { error: "Quá thời gian chờ (60s). n8n chưa xử lý xong, vui lòng thử lại." },
    { status: 504 }
  );
}
