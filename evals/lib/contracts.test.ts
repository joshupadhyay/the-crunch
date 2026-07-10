import { describe, expect, test } from "bun:test";
import {
  AGENT_TRACE_SCHEMA_VERSION,
  type AgentTrace,
  validateTrace,
} from "./contracts";
import { createSingleTurnTrace, sha256, tracesToJsonl } from "./run-artifacts";

describe("eval trace contracts", () => {
  test("creates a valid single-turn trace", () => {
    const trace = createSingleTurnTrace({
      runId: "run-1",
      caseId: "case-1",
      caseName: "Calls search",
      model: "open-model",
      provider: "openrouter",
      gitSha: "abc123",
      gitDirty: false,
      datasetSha256: "dataset-hash",
      promptSha256: "prompt-hash",
      input: "Find dinner in the West Village.",
      priorMessages: [],
      assistantEvents: [
        {
          kind: "tool_call",
          id: "call-1",
          name: "web_search",
          input: { query: "West Village dinner" },
        },
      ],
      scores: [
        {
          name: "required_tool_use",
          value: 1,
          grader: "deterministic",
        },
      ],
      overall: 1,
      startedAt: "2026-07-10T17:00:00.000Z",
      completedAt: "2026-07-10T17:00:01.000Z",
      durationMs: 1000,
      stopReason: "tool_use",
      tokenUsage: { input: 10, output: 5, total: 15 },
    });

    expect(trace.schemaVersion).toBe(AGENT_TRACE_SCHEMA_VERSION);
    expect(trace.events.map((event) => event.kind)).toEqual([
      "message",
      "tool_call",
    ]);
    expect(validateTrace(trace)).toEqual([]);
  });

  test("rejects orphaned tool results and invalid event order", () => {
    const trace: AgentTrace = {
      schemaVersion: AGENT_TRACE_SCHEMA_VERSION,
      traceId: "trace-1",
      runId: "run-1",
      caseId: "case-1",
      trial: 1,
      split: "development",
      scenario: { name: "Broken trace", taxonomy: [] },
      execution: {
        mode: "agent-loop",
        model: "model",
        provider: "provider",
        promptSha256: "prompt",
        datasetSha256: "dataset",
        toolMode: "fixture",
        startedAt: "2026-07-10T17:00:00.000Z",
        completedAt: "2026-07-10T17:00:01.000Z",
        durationMs: 1000,
      },
      events: [
        {
          sequence: 2,
          actor: "tool",
          kind: "tool_result",
          callId: "missing-call",
          toolName: "web_search",
          result: [],
          timestamp: "2026-07-10T17:00:01.000Z",
        },
      ],
      grading: { scores: [], accepted: false, rejectionReasons: [] },
      provenance: {
        gitSha: "abc123",
        gitDirty: false,
        parentTraceIds: [],
        piiRedactionVersion: "v1",
      },
    };

    expect(validateTrace(trace)).toEqual([
      "Event 0 must have sequence 1.",
      "Tool result missing-call has no preceding tool call.",
    ]);
  });

  test("hashes and serializes traces deterministically", () => {
    expect(sha256("the-crunch")).toHaveLength(64);

    const trace = {
      schemaVersion: AGENT_TRACE_SCHEMA_VERSION,
      traceId: "trace-1",
    } as AgentTrace;
    const jsonl = tracesToJsonl([trace]);

    expect(jsonl).toEndWith("\n");
    expect(JSON.parse(jsonl)).toMatchObject({ traceId: "trace-1" });
  });
});
