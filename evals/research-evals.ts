#!/usr/bin/env bun
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import type { ContentBlock, Tool } from "@anthropic-ai/sdk/resources/messages";
import { mkdir } from "node:fs/promises";
import { SYSTEM_PROMPT } from "../src/system-prompt";
import { TOOLS } from "../src/tools";

type EvalCase = {
  id: string;
  name: string;
  input: string;
  messages?: MessageParam[];
  expected: {
    requiredTools?: string[];
    forbiddenTools?: string[];
    requiredText?: string[];
    forbiddenText?: string[];
    contextKeys?: string[];
  };
};

type MetricResult = {
  name: string;
  score: number;
  detail: string;
};

type CaseResult = {
  id: string;
  name: string;
  input: string;
  outputText: string;
  toolCalls: string[];
  metrics: MetricResult[];
  overall: number;
  error?: string;
};

const MODEL = process.env.EVAL_MODEL ?? "claude-haiku-4-5-20251001";
const DATASET_NAME = "research/restaurant-concierge-regression";
const RUN_ID = `research-eval-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const REPORT_DIR = "evals/reports";
const CASES_PATH = "evals/research-eval-cases.json";
const LANGFUSE_HOST = process.env.LANGFUSE_BASE_URL ?? process.env.LANGFUSE_HOST;
const FAIL_ON_ERROR = process.env.EVAL_FAIL_ON_ERROR === "true";
const MIN_AVERAGE = Number(process.env.EVAL_MIN_AVERAGE ?? 0.8);

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{12,}/g,
  /pk-lf-[a-zA-Z0-9_-]{12,}/g,
  /sk-lf-[a-zA-Z0-9_-]{12,}/g,
  /postgres(?:ql)?:\/\/[^\s"'<>]+/g,
  /(ANTHROPIC_API_KEY|EXA_API_KEY|DATABASE_URL|TWITTER_SECRET|MAPBOX_ACCESS_TOKEN)=\S+/g,
];

function sanitize(value: unknown): string {
  let text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, "[REDACTED]");
  }
  return text;
}

function escapeHtml(value: unknown): string {
  return sanitize(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textFromContent(content: ContentBlock[]) {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function toolsFromContent(content: ContentBlock[]) {
  return content
    .filter((block) => block.type === "tool_use")
    .map((block) => block.name);
}

function extractContextBlock(text: string) {
  const match = text.match(/<!--context\s*([\s\S]*?)\s*-->/);
  if (!match?.[1]) return undefined;
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return "invalid";
  }
}

function scoreCase(testCase: EvalCase, outputText: string, toolCalls: string[]): MetricResult[] {
  const expected = testCase.expected;
  const metrics: MetricResult[] = [];

  const requiredTools = expected.requiredTools ?? [];
  const requiredHits = requiredTools.filter((tool) => toolCalls.includes(tool));
  metrics.push({
    name: "required_tool_use",
    score: requiredTools.length === 0 ? 1 : requiredHits.length / requiredTools.length,
    detail:
      requiredTools.length === 0
        ? "No required tools for this case."
        : `Expected ${requiredTools.join(", ")}; saw ${toolCalls.join(", ") || "none"}.`,
  });

  const forbiddenTools = expected.forbiddenTools ?? [];
  const forbiddenHits = forbiddenTools.filter((tool) => toolCalls.includes(tool));
  metrics.push({
    name: "forbidden_tool_avoidance",
    score: forbiddenHits.length === 0 ? 1 : 0,
    detail:
      forbiddenTools.length === 0
        ? "No forbidden tools for this case."
        : `Forbidden hits: ${forbiddenHits.join(", ") || "none"}.`,
  });

  const requiredText = expected.requiredText ?? [];
  const textHits = requiredText.filter((pattern) =>
    new RegExp(pattern, "i").test(outputText),
  );
  metrics.push({
    name: "constraint_capture",
    score: requiredText.length === 0 ? 1 : textHits.length / requiredText.length,
    detail:
      requiredText.length === 0
        ? "No required text patterns."
        : `Matched ${textHits.length}/${requiredText.length} required text patterns.`,
  });

  const forbiddenText = expected.forbiddenText ?? [];
  const forbiddenTextHits = forbiddenText.filter((pattern) =>
    new RegExp(pattern, "i").test(outputText),
  );
  metrics.push({
    name: "overasking_and_bad_claims",
    score: forbiddenTextHits.length === 0 ? 1 : 0,
    detail: `Forbidden text hits: ${forbiddenTextHits.join(", ") || "none"}.`,
  });

  const context = extractContextBlock(outputText);
  const expectedKeys = expected.contextKeys ?? [];
  const presentKeys =
    context && context !== "invalid"
      ? expectedKeys.filter((key) => Object.hasOwn(context, key))
      : [];
  metrics.push({
    name: "context_block_validity",
    score:
      expectedKeys.length === 0
        ? context === "invalid"
          ? 0
          : 1
        : context && context !== "invalid"
          ? presentKeys.length / expectedKeys.length
          : 0,
    detail:
      context === "invalid"
        ? "Context block exists but is invalid JSON."
        : expectedKeys.length === 0
          ? "No context block required."
          : `Expected context keys ${expectedKeys.join(", ")}; saw ${presentKeys.join(", ") || "none"}.`,
  });

  const questionCount = (outputText.match(/\?/g) ?? []).length;
  const asksOnlyTwo = questionCount <= 2;
  metrics.push({
    name: "flow_adherence",
    score: asksOnlyTwo ? 1 : Math.max(0, 1 - (questionCount - 2) * 0.25),
    detail: `Question count: ${questionCount}.`,
  });

  return metrics;
}

function errorMetrics(error: string): MetricResult[] {
  return [
    {
      name: "fatal_error",
      score: 0,
      detail: error,
    },
    {
      name: "required_tool_use",
      score: 0,
      detail: "Model call did not complete, so required tool behavior could not be evaluated.",
    },
    {
      name: "flow_adherence",
      score: 0,
      detail: "Model call did not complete, so flow behavior could not be evaluated.",
    },
  ];
}

async function runCase(testCase: EvalCase): Promise<CaseResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    const error = "ANTHROPIC_API_KEY is not set; live model evaluation skipped.";
    return {
      id: testCase.id,
      name: testCase.name,
      input: testCase.input,
      outputText: "",
      toolCalls: [],
      metrics: errorMetrics(error),
      overall: 0,
      error,
    };
  }

  try {
    await import("../src/observability");
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const messages: MessageParam[] = [
      ...(testCase.messages ?? []),
      { role: "user", content: testCase.input },
    ];

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages,
      tools: TOOLS as Tool[],
      metadata: {
        user_id: "eval-runner",
      },
    });

    const outputText = textFromContent(response.content);
    const toolCalls = toolsFromContent(response.content);
    const metrics = scoreCase(testCase, outputText, toolCalls);
    const overall =
      metrics.reduce((total, metric) => total + metric.score, 0) / metrics.length;

    return {
      id: testCase.id,
      name: testCase.name,
      input: testCase.input,
      outputText,
      toolCalls,
      metrics,
      overall,
    };
  } catch (error) {
    const message = error instanceof Error ? sanitize(error.message) : sanitize(error);
    return {
      id: testCase.id,
      name: testCase.name,
      input: testCase.input,
      outputText: "",
      toolCalls: [],
      metrics: errorMetrics(message),
      overall: 0,
      error: message,
    };
  }
}

async function postLangfuseScores(results: CaseResult[]) {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const host = LANGFUSE_HOST;

  if (!publicKey || !secretKey || !host) {
    return {
      enabled: false,
      detail:
        "LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, or LANGFUSE_BASE_URL/LANGFUSE_HOST is not set locally; report generated without posting Langfuse scores.",
    };
  }

  const auth = btoa(`${publicKey}:${secretKey}`);
  const scores = results.flatMap((result) => [
    {
      id: `${RUN_ID}-${result.id}-overall`,
      name: "research_eval_overall",
      value: result.overall,
      dataType: "NUMERIC",
      comment: `${result.id}: ${result.name}`,
    },
    ...result.metrics.map((metric) => ({
      id: `${RUN_ID}-${result.id}-${metric.name}`,
      name: `research_eval_${metric.name}`,
      value: metric.score,
      dataType: "NUMERIC",
      comment: `${result.id}: ${metric.detail}`.slice(0, 500),
    })),
  ]);

  for (const score of scores) {
    const resp = await fetch(`${host.replace(/\/$/, "")}/api/public/scores`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...score,
        sessionId: RUN_ID,
      }),
    });

    if (!resp.ok) {
      return {
        enabled: true,
        detail: `Langfuse score post failed with HTTP ${resp.status}; local report still generated.`,
      };
    }
  }

  return {
    enabled: true,
    detail: `Posted ${scores.length} session-level scores to Langfuse session ${RUN_ID}.`,
  };
}

function renderHtml(results: CaseResult[], langfuseStatus: { enabled: boolean; detail: string }) {
  const overall =
    results.reduce((total, result) => total + result.overall, 0) /
    Math.max(results.length, 1);
  const passCount = results.filter((result) => result.overall >= 0.8 && !result.error).length;
  const generatedAt = new Date().toISOString();
  const traceLink =
    LANGFUSE_HOST && langfuseStatus.enabled
      ? `${LANGFUSE_HOST.replace(/\/$/, "")}/sessions/${encodeURIComponent(RUN_ID)}`
      : undefined;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>The Crunch Research Eval Report</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f8f4ea; color: #2e2118; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 56px; }
    header { display: grid; gap: 10px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 34px; line-height: 1.05; }
    h2 { margin: 0 0 12px; font-size: 22px; }
    .meta { color: #6e5a48; line-height: 1.5; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 22px 0; }
    .tile, .case { background: #fffdf8; border: 1px solid #d8c8b4; border-radius: 8px; box-shadow: 0 1px 3px rgb(46 33 24 / 8%); }
    .tile { padding: 16px; }
    .tile strong { display: block; font-size: 28px; }
    .case { margin: 16px 0; overflow: hidden; }
    .case-head { display: flex; justify-content: space-between; gap: 16px; padding: 16px 18px; border-bottom: 1px solid #eadfce; }
    .case-title { font-weight: 800; }
    .score { font-variant-numeric: tabular-nums; font-weight: 800; }
    .pass { color: #196c43; }
    .fail { color: #a23622; }
    .body { padding: 16px 18px 18px; display: grid; gap: 14px; }
    .metrics { width: 100%; border-collapse: collapse; }
    .metrics th, .metrics td { padding: 9px 8px; border-bottom: 1px solid #efe5d5; text-align: left; vertical-align: top; }
    .metrics th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #755f4b; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #2e2118; color: #fff9ef; padding: 12px; border-radius: 6px; max-height: 280px; overflow: auto; }
    code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 13px; }
    .tools { color: #5d4634; }
    @media (max-width: 800px) { .summary { grid-template-columns: 1fr 1fr; } .case-head { display: grid; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>The Crunch Research Eval Report</h1>
      <div class="meta">
        Generated ${escapeHtml(generatedAt)} with model <code>${escapeHtml(MODEL)}</code>.<br />
        Dataset: <code>${escapeHtml(DATASET_NAME)}</code>. Run: <code>${escapeHtml(RUN_ID)}</code>.<br />
        Gate: average >= ${(MIN_AVERAGE * 100).toFixed(1)}%, fatal errors ${FAIL_ON_ERROR ? "fail" : "reported only"}.<br />
        Langfuse: ${escapeHtml(langfuseStatus.detail)}
        ${traceLink ? `<br />Session: <a href="${escapeHtml(traceLink)}">${escapeHtml(traceLink)}</a>` : ""}
      </div>
    </header>

    <section class="summary">
      <div class="tile"><span>Overall</span><strong>${(overall * 100).toFixed(1)}%</strong></div>
      <div class="tile"><span>Passing Cases</span><strong>${passCount}/${results.length}</strong></div>
      <div class="tile"><span>Cases</span><strong>${results.length}</strong></div>
      <div class="tile"><span>Pass Bar</span><strong>80%</strong></div>
    </section>

    ${results
      .map(
        (result) => `
      <section class="case">
        <div class="case-head">
          <div>
            <div class="case-title">${escapeHtml(result.name)}</div>
            <div class="meta"><code>${escapeHtml(result.id)}</code></div>
          </div>
          <div class="score ${result.overall >= 0.8 && !result.error ? "pass" : "fail"}">${(result.overall * 100).toFixed(1)}%</div>
        </div>
        <div class="body">
          <div><strong>Input</strong><pre><code>${escapeHtml(result.input)}</code></pre></div>
          <div class="tools"><strong>Tool calls:</strong> ${escapeHtml(result.toolCalls.join(", ") || "none")}</div>
          ${
            result.error
              ? `<div class="fail"><strong>Error:</strong> ${escapeHtml(result.error)}</div>`
              : ""
          }
          <table class="metrics">
                  <thead><tr><th>Metric</th><th>Score</th><th>Detail</th></tr></thead>
                  <tbody>
                    ${result.metrics
                      .map(
                        (metric) => `<tr>
                          <td><code>${escapeHtml(metric.name)}</code></td>
                          <td>${(metric.score * 100).toFixed(1)}%</td>
                          <td>${escapeHtml(metric.detail)}</td>
                        </tr>`,
                      )
                      .join("")}
                  </tbody>
                </table>
          ${
            result.error
              ? ""
              : `<div><strong>Model Output</strong><pre><code>${escapeHtml(result.outputText || "[no text output]")}</code></pre></div>`
          }
        </div>
      </section>`,
      )
      .join("")}
  </main>
</body>
</html>`;
}

async function main() {
  const cases = (await Bun.file(CASES_PATH).json()) as EvalCase[];
  await mkdir(REPORT_DIR, { recursive: true });

  const results: CaseResult[] = [];
  for (const testCase of cases) {
    console.log(`Running ${testCase.id}`);
    results.push(await runCase(testCase));
  }

  const langfuseStatus = await postLangfuseScores(results);
  const report = renderHtml(results, langfuseStatus);
  const reportPath = `${REPORT_DIR}/research-eval-report.html`;
  const resultsPath = `${REPORT_DIR}/research-eval-results.json`;

  await Bun.write(reportPath, report);
  await Bun.write(
    resultsPath,
    sanitize({
      runId: RUN_ID,
      model: MODEL,
      datasetName: DATASET_NAME,
      langfuseStatus,
      results,
    }),
  );

  const average =
    results.reduce((total, result) => total + result.overall, 0) /
    Math.max(results.length, 1);
  const errorCount = results.filter((result) => result.error).length;

  console.log(`Report: ${reportPath}`);
  console.log(`Results: ${resultsPath}`);
  console.log(`Average: ${(average * 100).toFixed(1)}%`);
  console.log(`Fatal errors: ${errorCount}`);

  if (FAIL_ON_ERROR && (errorCount > 0 || average < MIN_AVERAGE)) {
    console.error(
      `Research eval gate failed: average ${(average * 100).toFixed(1)}%, fatal errors ${errorCount}.`,
    );
    process.exitCode = 1;
  }
}

await main();
