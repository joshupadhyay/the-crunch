export const AGENT_TRACE_SCHEMA_VERSION = "agent-trace.v1" as const;
export const EVAL_RUN_SCHEMA_VERSION = "eval-run.v1" as const;

export type TraceActor = "user" | "assistant" | "tool" | "system" | "grader";

export type TraceEvent =
  | {
      sequence: number;
      actor: TraceActor;
      kind: "message";
      content: string;
      timestamp: string;
    }
  | {
      sequence: number;
      actor: "assistant";
      kind: "tool_call";
      callId: string;
      toolName: string;
      arguments: Record<string, unknown>;
      timestamp: string;
    }
  | {
      sequence: number;
      actor: "tool";
      kind: "tool_result";
      callId: string;
      toolName: string;
      result: unknown;
      fixtureId?: string;
      latencyMs?: number;
      timestamp: string;
    }
  | {
      sequence: number;
      actor: "system" | "tool" | "assistant";
      kind: "error";
      errorType: string;
      message: string;
      timestamp: string;
    };

export type TraceScore = {
  name: string;
  value: number;
  detail?: string;
  grader: "deterministic" | "model" | "human";
};

export type AgentTrace = {
  schemaVersion: typeof AGENT_TRACE_SCHEMA_VERSION;
  traceId: string;
  runId: string;
  caseId: string;
  trial: number;
  split: "development" | "regression" | "capability-holdout" | "sealed-live";
  scenario: {
    name: string;
    taxonomy: string[];
    seed?: number;
  };
  execution: {
    mode: "single-model-turn" | "agent-loop";
    model: string;
    provider: string;
    promptSha256: string;
    datasetSha256: string;
    toolMode: "not-executed" | "fixture" | "live" | "fault";
    startedAt: string;
    completedAt: string;
    durationMs: number;
    stopReason?: string | null;
    tokenUsage?: {
      input?: number;
      output?: number;
      total?: number;
    };
    estimatedCostUsd?: number;
  };
  events: TraceEvent[];
  grading: {
    scores: TraceScore[];
    accepted: boolean;
    rejectionReasons: string[];
  };
  provenance: {
    gitSha: string;
    gitDirty: boolean;
    worktreeSha256?: string;
    parentTraceIds: string[];
    generatorPromptSha256?: string;
    piiRedactionVersion: string;
  };
};

export type EvalRunManifest = {
  schemaVersion: typeof EVAL_RUN_SCHEMA_VERSION;
  runId: string;
  createdAt: string;
  gitSha: string;
  gitDirty: boolean;
  worktreeSha256?: string;
  dataset: {
    name: string;
    path: string;
    sha256: string;
    caseCount: number;
  };
  prompt: {
    path: string;
    sha256: string;
  };
  execution: {
    mode: "single-model-turn" | "agent-loop";
    provider: string;
    models: string[];
    trialsPerCase: number;
    toolMode: "not-executed" | "fixture" | "live" | "fault";
    maxTokens: number;
  };
  limitations: string[];
};

export function validateTrace(trace: AgentTrace): string[] {
  const errors: string[] = [];

  if (trace.schemaVersion !== AGENT_TRACE_SCHEMA_VERSION) {
    errors.push(`Unsupported trace schema: ${trace.schemaVersion}`);
  }
  if (!trace.traceId || !trace.runId || !trace.caseId) {
    errors.push("traceId, runId, and caseId are required.");
  }
  if (trace.trial < 1 || !Number.isInteger(trace.trial)) {
    errors.push("trial must be a positive integer.");
  }
  if (trace.execution.durationMs < 0) {
    errors.push("durationMs cannot be negative.");
  }

  for (let index = 0; index < trace.events.length; index += 1) {
    const expectedSequence = index + 1;
    if (trace.events[index]?.sequence !== expectedSequence) {
      errors.push(`Event ${index} must have sequence ${expectedSequence}.`);
    }
  }

  const callIds = new Set<string>();
  for (const event of trace.events) {
    if (event.kind === "tool_call") {
      callIds.add(event.callId);
    }
    if (event.kind === "tool_result" && !callIds.has(event.callId)) {
      errors.push(`Tool result ${event.callId} has no preceding tool call.`);
    }
  }

  if (
    trace.execution.toolMode === "not-executed" &&
    trace.events.some((event) => event.kind === "tool_result")
  ) {
    errors.push("A not-executed trace cannot contain tool results.");
  }

  return errors;
}
