# Evaluations

The current research eval is a **single-model-turn routing eval**. It checks the
first assistant response for tool selection, constraint capture, context structure,
and conversational flow. It does not execute tools or run the production agent loop
yet; every manifest records this limitation explicitly.

See [`docs/research-loop-plan.md`](../docs/research-loop-plan.md) for the full
benchmark and distillation design.

## Run one model

```bash
EVAL_PROVIDER=openrouter \
EVAL_MODELS=deepseek/deepseek-v4-pro \
bun run eval:research
```

## Compare models

Use model identifiers supported by the selected provider:

```bash
EVAL_PROVIDER=openrouter \
EVAL_MODELS="anthropic/<frontier-model-id>,<open-model-id>" \
bun run eval:research
```

For direct Anthropic evaluation, set `EVAL_PROVIDER=anthropic` and use Anthropic
model IDs. One run uses one provider so model observations and API behavior remain
comparable.

## Artifacts

The runner maintains the legacy latest-report files:

- `evals/reports/research-eval-report.html`
- `evals/reports/research-eval-results.json`

It also writes immutable per-run artifacts:

```text
evals/reports/runs/<run-id>/
├── manifest.json
├── report.html
├── results.json
└── traces.jsonl
```

`manifest.json` pins the dataset hash, system-prompt hash, git revision, provider,
models, and execution mode. `traces.jsonl` uses the provider-neutral
`agent-trace.v1` contract.

## Contract checks

```bash
bun run eval:contracts
```

The next infrastructure milestone is to invoke the shared production agent loop and
replay frozen tool fixtures. Until that lands, do not present these scores as
end-to-end recommendation quality.
