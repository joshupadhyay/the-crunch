#!/usr/bin/env bun
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import type { ContentBlock, Tool } from "@anthropic-ai/sdk/resources/messages";
import { mkdir } from "node:fs/promises";
import { SYSTEM_PROMPT } from "../src/system-prompt";
import { TOOLS } from "../src/tools";
import type {
  AgentTrace,
  EvalRunManifest,
  TraceScore,
} from "./lib/contracts";
import {
  createRunManifest,
  createSingleTurnTrace,
  tracesToJsonl,
} from "./lib/run-artifacts";

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
  model: string;
  input: string;
  outputText: string;
  toolCalls: string[];
  metrics: MetricResult[];
  overall: number;
  routingPassed: boolean;
  durationMs: number;
  traceId: string;
  error?: string;
};

type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

type AssistantTraceEvent =
  | { kind: "message"; content: string }
  | {
      kind: "tool_call";
      id: string;
      name: string;
      input: Record<string, unknown>;
    };

type RunCaseResult = {
  result: CaseResult;
  trace: AgentTrace;
};

const DEFAULT_MODEL = process.env.OPENROUTER_API_KEY
  ? "deepseek/deepseek-v4-pro"
  : "claude-haiku-4-5-20251001";
const MODELS = (
  process.env.EVAL_MODELS ??
  process.env.EVAL_MODEL ??
  process.env.LLM_MODEL ??
  DEFAULT_MODEL
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const PROVIDER =
  process.env.EVAL_PROVIDER ??
  (process.env.OPENROUTER_API_KEY ? "openrouter" : "anthropic");
const DATASET_NAME = "research/restaurant-concierge-regression";
const RUN_ID = `research-eval-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const REPORT_DIR = "evals/reports";
const RUN_REPORT_DIR = `${REPORT_DIR}/runs/${RUN_ID}`;
const CASES_PATH = "evals/research-eval-cases.json";
const PROMPT_PATH = "src/system-prompt.ts";
const MAX_TOKENS = 1200;
const LANGFUSE_HOST = process.env.LANGFUSE_BASE_URL ?? process.env.LANGFUSE_HOST;
const FAIL_ON_ERROR = process.env.EVAL_FAIL_ON_ERROR === "true";
const MIN_AVERAGE = Number(process.env.EVAL_MIN_AVERAGE ?? 0.8);

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{12,}/g,
  /pk-lf-[a-zA-Z0-9_-]{12,}/g,
  /sk-lf-[a-zA-Z0-9_-]{12,}/g,
  /postgres(?:ql)?:\/\/[^\s"'<>]+/g,
  /(ANTHROPIC_API_KEY|OPENROUTER_API_KEY|DEEPSEEK_API_KEY|LANGFUSE_SECRET_KEY|EXA_API_KEY|DATABASE_URL|TWITTER_SECRET|MAPBOX_ACCESS_TOKEN)=\S+/g,
];

function validateEvalCases(value: unknown): asserts value is EvalCase[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Eval dataset must be a non-empty array.");
  }

  const ids = new Set<string>();
  for (const [index, testCase] of value.entries()) {
    if (!testCase || typeof testCase !== "object") {
      throw new Error(`Eval case ${index} must be an object.`);
    }
    const candidate = testCase as Partial<EvalCase>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.name !== "string" ||
      typeof candidate.input !== "string" ||
      !candidate.expected ||
      typeof candidate.expected !== "object"
    ) {
      throw new Error(
        `Eval case ${index} requires string id, name, input, and expected fields.`,
      );
    }
    if (ids.has(candidate.id)) {
      throw new Error(`Duplicate eval case id: ${candidate.id}`);
    }
    ids.add(candidate.id);

    for (const field of ["requiredText", "forbiddenText"] as const) {
      const patterns = candidate.expected[field] ?? [];
      if (!Array.isArray(patterns)) {
        throw new Error(`${candidate.id}.${field} must be an array.`);
      }
      for (const pattern of patterns) {
        if (typeof pattern !== "string") {
          throw new Error(`${candidate.id}.${field} values must be strings.`);
        }
        try {
          new RegExp(pattern, "i");
        } catch {
          throw new Error(`${candidate.id}.${field} has invalid regex: ${pattern}`);
        }
      }
    }
  }
}

function sanitize(value: unknown): string {
  let text =
    typeof value === "string"
      ? value
      : (JSON.stringify(value, null, 2) ?? String(value));
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

function toolCallsFromContent(content: ContentBlock[]): ToolCall[] {
  return content
    .filter((block) => block.type === "tool_use")
    .map((block) => ({
      id: block.id,
      name: block.name,
      input: block.input as Record<string, unknown>,
    }));
}

function assistantEventsFromContent(
  content: ContentBlock[],
): AssistantTraceEvent[] {
  const events: AssistantTraceEvent[] = [];
  for (const block of content) {
    if (block.type === "text") {
      events.push({ kind: "message", content: block.text });
    } else if (block.type === "tool_use") {
      events.push({
        kind: "tool_call",
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      });
    }
  }
  return events;
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

function traceScores(metrics: MetricResult[]): TraceScore[] {
  return metrics.map((metric) => ({
    name: metric.name,
    value: metric.score,
    detail: metric.detail,
    grader: "deterministic",
  }));
}

function passesRoutingGate(metrics: MetricResult[], overall: number): boolean {
  return metrics.every((metric) => metric.score === 1) && overall >= MIN_AVERAGE;
}

async function createEvalClient() {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");

  if (PROVIDER === "openrouter") {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new Error(
        "EVAL_PROVIDER=openrouter requires OPENROUTER_API_KEY.",
      );
    }
    return new Anthropic({
      apiKey: null,
      authToken: key,
      baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api",
      defaultHeaders: {
        "HTTP-Referer":
          process.env.OPENROUTER_HTTP_REFERER ??
          "https://d2w56c6hcnyw72.cloudfront.net",
        "X-OpenRouter-Title":
          process.env.OPENROUTER_APP_TITLE ?? "The Crunch",
      },
    });
  }

  if (PROVIDER === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        "EVAL_PROVIDER=anthropic requires ANTHROPIC_API_KEY.",
      );
    }
    return new Anthropic({ apiKey: key });
  }

  throw new Error(
    `Unsupported EVAL_PROVIDER "${PROVIDER}". Use openrouter or anthropic.`,
  );
}

async function runCase(
  testCase: EvalCase,
  model: string,
  manifest: EvalRunManifest,
): Promise<RunCaseResult> {
  const startedAt = new Date().toISOString();
  const startedMs = performance.now();
  const priorMessages = (testCase.messages ?? []).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  try {
    await import("../src/observability");
    const client = await createEvalClient();
    const messages: MessageParam[] = [
      ...(testCase.messages ?? []),
      { role: "user", content: testCase.input },
    ];

    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages,
      tools: TOOLS as Tool[],
      metadata: {
        user_id: "eval-runner",
      },
    });

    const completedAt = new Date().toISOString();
    const durationMs = Math.round(performance.now() - startedMs);
    const outputText = textFromContent(response.content);
    const calls = toolCallsFromContent(response.content);
    const toolCalls = calls.map((call) => call.name);
    const metrics = scoreCase(testCase, outputText, toolCalls);
    const overall =
      metrics.reduce((total, metric) => total + metric.score, 0) / metrics.length;
    const routingPassed = passesRoutingGate(metrics, overall);
    const trace = createSingleTurnTrace({
      runId: RUN_ID,
      caseId: testCase.id,
      caseName: testCase.name,
      model,
      provider: PROVIDER,
      gitSha: manifest.gitSha,
      gitDirty: manifest.gitDirty,
      worktreeSha256: manifest.worktreeSha256,
      datasetSha256: manifest.dataset.sha256,
      promptSha256: manifest.prompt.sha256,
      input: testCase.input,
      priorMessages,
      assistantEvents: assistantEventsFromContent(response.content),
      scores: traceScores(metrics),
      overall,
      startedAt,
      completedAt,
      durationMs,
      stopReason: response.stop_reason,
      tokenUsage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
    });

    return {
      result: {
        id: testCase.id,
        name: testCase.name,
        model,
        input: testCase.input,
        outputText,
        toolCalls,
        metrics,
        overall,
        routingPassed,
        durationMs,
        traceId: trace.traceId,
      },
      trace,
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const durationMs = Math.round(performance.now() - startedMs);
    const message = error instanceof Error ? sanitize(error.message) : sanitize(error);
    const metrics = errorMetrics(message);
    const trace = createSingleTurnTrace({
      runId: RUN_ID,
      caseId: testCase.id,
      caseName: testCase.name,
      model,
      provider: PROVIDER,
      gitSha: manifest.gitSha,
      gitDirty: manifest.gitDirty,
      worktreeSha256: manifest.worktreeSha256,
      datasetSha256: manifest.dataset.sha256,
      promptSha256: manifest.prompt.sha256,
      input: testCase.input,
      priorMessages,
      assistantEvents: [],
      scores: traceScores(metrics),
      overall: 0,
      error: message,
      startedAt,
      completedAt,
      durationMs,
    });

    return {
      result: {
        id: testCase.id,
        name: testCase.name,
        model,
        input: testCase.input,
        outputText: "",
        toolCalls: [],
        metrics,
        overall: 0,
        routingPassed: false,
        durationMs,
        traceId: trace.traceId,
        error: message,
      },
      trace,
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
  const scores = results.flatMap((result) => {
    const modelId = result.model.replace(/[^a-zA-Z0-9_-]/g, "-");
    return [
      {
        id: `${RUN_ID}-${modelId}-${result.id}-overall`,
        name: "research_eval_overall",
        value: result.overall,
        dataType: "NUMERIC",
        comment: `${result.model} / ${result.id}: ${result.name}`,
      },
      ...result.metrics.map((metric) => ({
        id: `${RUN_ID}-${modelId}-${result.id}-${metric.name}`,
        name: `research_eval_${metric.name}`,
        value: metric.score,
        dataType: "NUMERIC",
        comment: `${result.model} / ${result.id}: ${metric.detail}`.slice(
          0,
          500,
        ),
      })),
    ];
  });

  try {
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
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      enabled: true,
      detail: `Langfuse score post failed: ${detail.slice(0, 200)}; local report still generated.`,
    };
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
  const passCount = results.filter((result) => result.routingPassed).length;
  const modelSummaries = MODELS.map((model) => {
    const modelResults = results.filter((result) => result.model === model);
    return {
      model,
      average:
        modelResults.reduce((total, result) => total + result.overall, 0) /
        Math.max(modelResults.length, 1),
      passing: modelResults.filter((result) => result.routingPassed).length,
      total: modelResults.length,
      errors: modelResults.filter((result) => result.error).length,
      durationMs: modelResults.reduce(
        (total, result) => total + result.durationMs,
        0,
      ),
    };
  });
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
        Generated ${escapeHtml(generatedAt)} with models <code>${escapeHtml(MODELS.join(", "))}</code>.<br />
        Dataset: <code>${escapeHtml(DATASET_NAME)}</code>. Run: <code>${escapeHtml(RUN_ID)}</code>.<br />
        Gate: average >= ${(MIN_AVERAGE * 100).toFixed(1)}%, fatal errors ${FAIL_ON_ERROR ? "fail" : "reported only"}.<br />
        Langfuse: ${escapeHtml(langfuseStatus.detail)}
        ${traceLink ? `<br />Session: <a href="${escapeHtml(traceLink)}">${escapeHtml(traceLink)}</a>` : ""}
      </div>
    </header>

    <section class="summary">
      <div class="tile"><span>Overall</span><strong>${(overall * 100).toFixed(1)}%</strong></div>
      <div class="tile"><span>Routing Passes</span><strong>${passCount}/${results.length}</strong></div>
      <div class="tile"><span>Cases</span><strong>${results.length}</strong></div>
      <div class="tile"><span>Pass Bar</span><strong>80%</strong></div>
    </section>

    <section class="case">
      <div class="case-head"><div class="case-title">Model comparison</div></div>
      <div class="body">
        <table class="metrics">
          <thead><tr><th>Model</th><th>Average</th><th>Passing</th><th>Errors</th><th>Total latency</th></tr></thead>
          <tbody>
            ${modelSummaries
              .map(
                (summary) => `<tr>
                  <td><code>${escapeHtml(summary.model)}</code></td>
                  <td>${(summary.average * 100).toFixed(1)}%</td>
                  <td>${summary.passing}/${summary.total}</td>
                  <td>${summary.errors}</td>
                  <td>${summary.durationMs} ms</td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>

    ${results
      .map(
        (result) => `
      <section class="case">
        <div class="case-head">
          <div>
            <div class="case-title">${escapeHtml(result.name)}</div>
            <div class="meta"><code>${escapeHtml(result.model)}</code> · <code>${escapeHtml(result.id)}</code> · ${escapeHtml(result.durationMs)} ms · trace <code>${escapeHtml(result.traceId)}</code></div>
          </div>
          <div class="score ${result.routingPassed ? "pass" : "fail"}">${(result.overall * 100).toFixed(1)}%</div>
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
  if (MODELS.length === 0) {
    throw new Error("EVAL_MODELS must contain at least one model ID.");
  }

  const casesDocument: unknown = await Bun.file(CASES_PATH).json();
  validateEvalCases(casesDocument);
  const cases = casesDocument;
  await mkdir(RUN_REPORT_DIR, { recursive: true });
  const manifest = await createRunManifest({
    runId: RUN_ID,
    datasetName: DATASET_NAME,
    datasetPath: CASES_PATH,
    promptPath: PROMPT_PATH,
    caseCount: cases.length,
    provider: PROVIDER,
    models: MODELS,
    maxTokens: MAX_TOKENS,
  });

  const results: CaseResult[] = [];
  const traces: AgentTrace[] = [];
  for (const model of MODELS) {
    for (const testCase of cases) {
      console.log(`Running ${model} / ${testCase.id}`);
      const run = await runCase(testCase, model, manifest);
      results.push(run.result);
      traces.push(run.trace);
    }
  }

  const reportPath = `${REPORT_DIR}/research-eval-report.html`;
  const resultsPath = `${REPORT_DIR}/research-eval-results.json`;
  const versionedReportPath = `${RUN_REPORT_DIR}/report.html`;
  const versionedResultsPath = `${RUN_REPORT_DIR}/results.json`;
  const manifestPath = `${RUN_REPORT_DIR}/manifest.json`;
  const tracesPath = `${RUN_REPORT_DIR}/traces.jsonl`;

  await Bun.write(manifestPath, sanitize(manifest));
  await Bun.write(tracesPath, sanitize(tracesToJsonl(traces)));

  const langfuseStatus = await postLangfuseScores(results);
  const report = renderHtml(results, langfuseStatus);
  await Bun.write(reportPath, report);
  await Bun.write(versionedReportPath, report);
  const resultDocument = sanitize({
    manifest,
    langfuseStatus,
    results,
  });
  await Bun.write(resultsPath, resultDocument);
  await Bun.write(versionedResultsPath, resultDocument);

  const average =
    results.reduce((total, result) => total + result.overall, 0) /
    Math.max(results.length, 1);
  const errorCount = results.filter((result) => result.error).length;

  console.log(`Report: ${reportPath}`);
  console.log(`Results: ${resultsPath}`);
  console.log(`Run artifacts: ${RUN_REPORT_DIR}`);
  console.log(`Average: ${(average * 100).toFixed(1)}%`);
  console.log(`Fatal errors: ${errorCount}`);

  const failedModels = MODELS.filter((model) => {
    const modelResults = results.filter((result) => result.model === model);
    const modelAverage =
      modelResults.reduce((total, result) => total + result.overall, 0) /
      Math.max(modelResults.length, 1);
    return (
      modelResults.some((result) => result.error || !result.routingPassed) ||
      modelAverage < MIN_AVERAGE
    );
  });

  if (FAIL_ON_ERROR && failedModels.length > 0) {
    console.error(
      `Research eval gate failed for models: ${failedModels.join(", ")}.`,
    );
    process.exitCode = 1;
  }
}

try {
  await main();
} finally {
  const { shutdownObservability } = await import("../src/observability");
  await shutdownObservability();
}
