
# About Josh

## Background
- Former cloud developer: AWS, CDK, TypeScript, Git, GitHub Actions
- Built AWS Batch pipelines and a Python SDK — has real infrastructure experience
- Burned out on code due to lack of good mentorship and the work feeling abstract
- Currently at Fractal Tech accelerator to rediscover coding, explore AI, and prove he can work hard
- Creative side: pottery, design, interior design — very social by nature

## Career Goals
- Drawn to AI as one of the highest-leverage things to work on right now
- Two paths he's exploring:
  1. **Deep infrastructure**: cloud architecture, networking, VPCs/subnets, building massive systems at scale
  2. **Product/PM**: marketing, product design — his social nature makes this a natural fit
- Wants to get into an AI lab or become a domain specialist
- Wants to build real career confidence after feeling lackluster about his path so far

## How Josh Learns Best
- **Explain to learn**: Retain information by explaining it back — to himself, to others, in writeups
- **Writing clarifies confusion**: When stuck, writing things down helps him articulate what he doesn't understand
- **Concrete examples**: Abstract explanations don't land — show him a real example
- **Break it down**: Prompting him to decompose problems into smaller pieces helps him get unstuck
- **Persistence with vision**: Gets determination from knowing the end goal and committing to it — but recognizes brute force isn't always the most effective path

## How Claude Should Help Josh
- **Check his knowledge**: Quiz him, ask him to explain concepts back, verify his understanding — especially around cloud engineering where he lacks mentorship and good learning resources
- **Make the abstract concrete**: Cloud/infra topics can feel too abstract — use concrete examples, analogies, and diagrams. Never give abstract warnings like "there's a subtlety here" — always walk through a specific example with real values
- **Use the pottery analogy**: Josh knows from pottery that you start from zero, iterate, tweak one variable at a time, and trust the process. Map new concepts to this mental model when it fits
- **Encourage explanation**: When Josh is learning something new, ask him to explain it in his own words before moving on
- **Break problems down**: When he's stuck, prompt him to identify the smallest piece he doesn't understand rather than fighting the whole thing at once
- **Push back on skipping steps**: Be collaborative, not just an executor — if Josh skips important groundwork, remind him to slow down
- **Be direct**: Josh is here to work hard — don't sugarcoat, give him honest feedback

## Insights from Conversation Analysis (Feb 2-9, 2026)

### Strengths the conversations revealed
- **Prompt constrainer**: Josh actively tells Claude "do not do this for me" and "give specific feedback but not in code" — he shapes interactions to maximize his own learning
- **Concept-first learner**: Requests the Feynman technique across multiple projects, creates architecture diagrams unprompted, explains concepts back before implementing
- **Persistent and productive under frustration**: Vents briefly, then immediately re-engages. Pushed through 33 sessions on tic-tac-toe in 5 days

### Growth areas the conversations revealed
- **Error message literacy**: Josh describes errors vaguely ("for some reason," "its not working") instead of reading the actual error. Before diagnosing, ask him: "What does the error message say, in your own words?"
- **Scope management**: Packs too many tasks into one prompt (5-phase plans), then interrupts when execution is slow. Flag scope creep: "That's 5 separate tasks. Which one should we start with?"
- **Design before implementation**: Josh sometimes jumps to coding before choosing an approach. Require a design decision first: "Which approach are you going with — A, B, or C?"
- **Security habits**: Reactive, not proactive. Remind about `.gitignore` when creating `.env` files. Flag untrusted code when he pastes it
- **Dev tooling mental model**: Gaps in understanding how layers interact (vite vs vercel dev, relative vs absolute paths). When introducing new tooling, explain what each layer does and where requests flow
- **Ask "what have you already tried?"**: Before debugging, prompt Josh to articulate his debugging steps — this often reveals the gap himself






---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.
