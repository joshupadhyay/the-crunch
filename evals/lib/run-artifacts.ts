import {
  AGENT_TRACE_SCHEMA_VERSION,
  EVAL_RUN_SCHEMA_VERSION,
  type AgentTrace,
  type EvalRunManifest,
  type TraceEvent,
  type TraceScore,
} from "./contracts";

type RunArtifactConfig = {
  runId: string;
  datasetName: string;
  datasetPath: string;
  promptPath: string;
  caseCount: number;
  provider: string;
  models: string[];
  maxTokens: number;
};

type TraceArtifactInput = {
  runId: string;
  caseId: string;
  caseName: string;
  model: string;
  provider: string;
  gitSha: string;
  gitDirty: boolean;
  worktreeSha256?: string;
  datasetSha256: string;
  promptSha256: string;
  input: string;
  priorMessages: Array<{ role: "user" | "assistant"; content: unknown }>;
  assistantEvents: Array<
    | { kind: "message"; content: string }
    | {
        kind: "tool_call";
        id: string;
        name: string;
        input: Record<string, unknown>;
      }
  >;
  scores: TraceScore[];
  overall: number;
  error?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  stopReason?: string | null;
  tokenUsage?: {
    input?: number;
    output?: number;
    total?: number;
  };
};

export function sha256(value: string | Uint8Array): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(value);
  return hasher.digest("hex");
}

export async function sha256File(path: string): Promise<string> {
  return sha256(
    await Bun.file(path)
      .arrayBuffer()
      .then((buffer) => new Uint8Array(buffer)),
  );
}

export function currentGitSha(): string {
  const fromEnvironment = process.env.GITHUB_SHA?.trim();
  if (fromEnvironment) return fromEnvironment;

  const result = Bun.spawnSync(["git", "rev-parse", "HEAD"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  if (result.exitCode !== 0) return "unknown";
  return result.stdout.toString().trim() || "unknown";
}

async function currentGitState(): Promise<{
  dirty: boolean;
  worktreeSha256?: string;
}> {
  const statusResult = Bun.spawnSync(
    ["git", "status", "--porcelain=v1", "--untracked-files=all"],
    {
      stdout: "pipe",
      stderr: "ignore",
    },
  );
  if (statusResult.exitCode !== 0) return { dirty: false };

  const status = statusResult.stdout.toString();
  if (!status.trim()) return { dirty: false };

  const diffResult = Bun.spawnSync(["git", "diff", "--binary", "HEAD"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const untrackedPaths = status
    .split("\n")
    .filter((line) => line.startsWith("?? "))
    .map((line) => line.slice(3))
    .filter(Boolean);
  const untrackedHashes = await Promise.all(
    untrackedPaths.map(async (path) => {
      const file = Bun.file(path);
      return (await file.exists())
        ? `${path}:${await sha256File(path)}`
        : `${path}:missing`;
    }),
  );
  const fingerprint = [
    status,
    diffResult.exitCode === 0 ? diffResult.stdout.toString() : "",
    ...untrackedHashes,
  ].join("\n");

  return { dirty: true, worktreeSha256: sha256(fingerprint) };
}

export async function createRunManifest(
  config: RunArtifactConfig,
): Promise<EvalRunManifest> {
  const gitState = await currentGitState();
  return {
    schemaVersion: EVAL_RUN_SCHEMA_VERSION,
    runId: config.runId,
    createdAt: new Date().toISOString(),
    gitSha: currentGitSha(),
    gitDirty: gitState.dirty,
    worktreeSha256: gitState.worktreeSha256,
    dataset: {
      name: config.datasetName,
      path: config.datasetPath,
      sha256: await sha256File(config.datasetPath),
      caseCount: config.caseCount,
    },
    prompt: {
      path: config.promptPath,
      sha256: await sha256File(config.promptPath),
    },
    execution: {
      mode: "single-model-turn",
      provider: config.provider,
      models: config.models,
      trialsPerCase: 1,
      toolMode: "not-executed",
      maxTokens: config.maxTokens,
    },
    limitations: [
      "This runner evaluates one model turn and does not execute requested tools.",
      "It does not yet exercise the production streaming agent loop.",
      "Scores measure routing and response structure, not grounded itinerary quality.",
    ],
  };
}

function contentToString(content: unknown): string {
  return typeof content === "string"
    ? content
    : (JSON.stringify(content) ?? String(content));
}

export function createSingleTurnTrace(
  input: TraceArtifactInput,
): AgentTrace {
  const timestamp = input.startedAt;
  const events: TraceEvent[] = [];
  let sequence = 1;

  for (const message of input.priorMessages) {
    events.push({
      sequence,
      actor: message.role,
      kind: "message",
      content: contentToString(message.content),
      timestamp,
    });
    sequence += 1;
  }

  events.push({
    sequence,
    actor: "user",
    kind: "message",
    content: input.input,
    timestamp,
  });
  sequence += 1;

  for (const assistantEvent of input.assistantEvents) {
    if (assistantEvent.kind === "tool_call") {
      events.push({
        sequence,
        actor: "assistant",
        kind: "tool_call",
        callId: assistantEvent.id,
        toolName: assistantEvent.name,
        arguments: assistantEvent.input,
        timestamp: input.completedAt,
      });
    } else {
      events.push({
        sequence,
        actor: "assistant",
        kind: "message",
        content: assistantEvent.content,
        timestamp: input.completedAt,
      });
    }
    sequence += 1;
  }

  if (input.error) {
    events.push({
      sequence,
      actor: "system",
      kind: "error",
      errorType: "model_call_error",
      message: input.error,
      timestamp: input.completedAt,
    });
  }

  return {
    schemaVersion: AGENT_TRACE_SCHEMA_VERSION,
    traceId: crypto.randomUUID(),
    runId: input.runId,
    caseId: input.caseId,
    trial: 1,
    split: "regression",
    scenario: {
      name: input.caseName,
      taxonomy: ["research-flow", "single-turn"],
    },
    execution: {
      mode: "single-model-turn",
      model: input.model,
      provider: input.provider,
      promptSha256: input.promptSha256,
      datasetSha256: input.datasetSha256,
      toolMode: "not-executed",
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      durationMs: input.durationMs,
      stopReason: input.stopReason,
      tokenUsage: input.tokenUsage,
    },
    events,
    grading: {
      scores: input.scores,
      accepted: false,
      rejectionReasons: [
        ...(input.error ? [input.error] : []),
        ...(input.overall < 0.8
          ? [`Overall score ${input.overall.toFixed(3)} is below 0.8.`]
          : []),
        "Single-turn routing traces are not eligible for training acceptance.",
      ],
    },
    provenance: {
      gitSha: input.gitSha,
      gitDirty: input.gitDirty,
      worktreeSha256: input.worktreeSha256,
      parentTraceIds: [],
      piiRedactionVersion: "none-eval-inputs-v1",
    },
  };
}

export function tracesToJsonl(traces: AgentTrace[]): string {
  return `${traces.map((trace) => JSON.stringify(trace)).join("\n")}\n`;
}
