# Serverless Review Checklist

Use this before approving the next deploy.

## Changes to Review

- AWS-first serverless deploy path remains Lambda Web Adapter + CloudFront +
  DynamoDB + Secrets Manager.
- Deploy workflow validates app and CDK before any deploy step.
- Research eval workflow runs manually, uploads HTML/JSON artifacts, and fails
  on fatal eval errors or average score below 80%.
- Chat persistence is user-scoped across local, DynamoDB, and Supabase adapters.
- DynamoDB production listing uses `userId-createdAt-index`.
- Chat streaming has a tool-loop guard and clearer malformed tool-input errors.
- Frontend now displays server stream error messages.

## Commands

```sh
bun run check
bun run check:infra
bun run eval:research
```

Expected local state right now:

- `bun run check` passes.
- `bun run check:infra` passes.
- `bun run eval:research` writes reports but scores 0% locally because the local
  Anthropic key is invalid.

## External Gates Before Deploy

- Supabase transaction-pooler connectivity has been verified, the GitHub
  `DATABASE_URL` secret has been updated, and the Better Auth schema has been
  applied.
- Finish Sentry signup, create a project, and set `SENTRY_DSN` and
  `PUBLIC_SENTRY_DSN` as repository secrets. Leave sample rates at `0` for the
  first PoC deploy unless there is a specific reason to trace or replay.
- Run the manual `Research evals` workflow with repository secrets and review
  the uploaded report.
- Confirm whether old DynamoDB chat data can be ignored, archived, or must be
  backfilled before deploying the new user-scoped key/index shape.
- Deploy only after review approval.

## Current Known Blockers

- Local `ANTHROPIC_API_KEY` returns `invalid x-api-key`.
- Local AWS auth is expired, so Secrets Manager cannot be read from this
  machine.
- No post-review deploy has been run.
