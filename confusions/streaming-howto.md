# How Streaming Works in The Crunch

## Overview — 3 Layers

**Frontend (ChatView.tsx)** → **Server (server.ts)** → **Chatbot (AnthropicChatBot.ts)**

The user sends a message. The server opens an SSE (Server-Sent Events) stream back to the browser. The chatbot streams tokens from the Anthropic API and forwards them through the server to the frontend. If the AI uses a tool, the stream pauses, the tool executes, and the stream resumes with the AI's follow-up response.

---

## Layer 1: AnthropicChatBot.ts — `streamMessage()` (async generator)

This is the core. It's an **async generator function** (`async *streamMessage()`), which means it `yield`s events one at a time as they happen, rather than returning everything at once.

### Flow:
1. **Save user message** to DB, load full conversation history
2. **Enter a `while` loop** — this loop exists because tool calls require multiple API round-trips
3. **Call `client.messages.stream()`** — the Anthropic SDK streams the response
4. **`for await` over stream events** — when you get a `text_delta`, `yield` it as `{ type: "text", text: "..." }`
5. **After stream ends**, get `finalMessage` — the complete response object
6. **Save assistant message** to DB, push to local messages array
7. **Check `stop_reason`**:
   - If `"tool_use"`: extract tool_use blocks, execute them via `executeTool()`, save tool results as a "user" message (Anthropic SDK requires this), `yield` tool events, and **loop continues** (go back to step 3)
   - If anything else (usually `"end_turn"`): **exit the loop**
8. **`yield { type: "done" }`** — signals the stream is complete

### Event types yielded:
- `{ type: "text", text: "..." }` — a chunk of the AI's response
- `{ type: "tool_start", name: "tool_name" }` — tool execution is beginning
- `{ type: "tool_result" }` — tool finished, next iteration will stream the AI's follow-up
- `{ type: "done" }` — everything is finished
- `{ type: "error", message: "..." }` — something went wrong

### Key concept: The generator IS the stream
The `while` loop + `yield` pattern means the caller (server.ts) consumes events one at a time with `for await...of`. The generator pauses at each `yield` until the caller is ready for the next event. This is what makes it "streaming" — the function doesn't finish and return; it produces values over time.

---

## Layer 2: server.ts — `/api/chat/send` SSE endpoint

The server converts the generator into an HTTP SSE response.

### Flow:
1. Parse `{ conversationId, message }` from the POST body
2. Create a `ReadableStream` — this is a web-standard stream that becomes the HTTP response body
3. In the stream's `start()` callback:
   - `for await` over `chatbot.streamMessage(conversationId, message)`
   - For each event, encode it as `data: ${JSON.stringify(event)}\n\n` (SSE format)
   - Enqueue each encoded chunk into the stream's controller
4. Return the `ReadableStream` as a `Response` with headers:
   - `Content-Type: text/event-stream`
   - `Cache-Control: no-cache`
   - `Connection: keep-alive`

### SSE format
Each event looks like this on the wire:
```
data: {"type":"text","text":"Hey "}\n\n
data: {"type":"text","text":"there!"}\n\n
data: {"type":"done"}\n\n
```
The `data: ` prefix and double newline `\n\n` are the SSE protocol. The browser's fetch API reads these as chunks.

---

## Layer 3: ChatView.tsx — Frontend SSE consumer

The frontend reads the SSE stream using `fetch` + `ReadableStream` reader (NOT `EventSource` — that's GET-only, and we need POST).

### Flow:
1. **POST** to `/api/chat/send` with `{ conversationId, message }`
2. Get a `reader` from `res.body.getReader()`
3. Add an empty assistant message to state (placeholder to fill progressively)
4. **Read loop**: `while (true)` calling `reader.read()`
   - Decode bytes to string, accumulate in a `buffer`
   - Split buffer on `\n\n` (SSE event boundary)
   - Last element stays in buffer (might be incomplete)
   - Parse each complete event: strip `data: ` prefix, `JSON.parse` the rest
5. **Handle event types**:
   - `text`: Append to `fullText`, update the last message in state with `cleanStreamingText(fullText)` (hides incomplete `<!--context` blocks)
   - `error`: Show error in the message bubble
   - `done`: Run `extractContext(fullText)` to pull out the `<!--context {...} -->` JSON, update message with clean text, fire `onContextUpdate` with extracted preferences/restaurants
6. **Cleanup**: `setIsLoading(false)`, refocus input

### Helper functions:
- `cleanStreamingText(text)`: While streaming, the AI might be mid-way through writing `<!--context {...} -->`. This function hides any incomplete context block so the user doesn't see raw JSON.
- `extractContext(text)`: After streaming is done, this pulls the full `<!--context {...} -->` block out, parses the JSON, and returns `{ cleanText, context }`.

---

## Tool Call Round-Trip (the tricky part)

When the AI decides to use a tool, the flow looks like this:

1. AI streams: "Let me search for Italian restaurants..." → `text` events
2. AI stops with `stop_reason: "tool_use"` → generator yields `tool_start`
3. Generator executes the tool (e.g., `searchRestaurants(...)`) server-side
4. Generator stores tool results as a "user" message (SDK requirement — tool results go in user role)
5. Generator yields `tool_result`, then **loops back** to call `client.messages.stream()` again
6. AI now sees the tool results and streams its follow-up: "I found some great spots..." → more `text` events
7. If no more tools needed → `stop_reason: "end_turn"` → loop exits → yields `done`

The `while (continueLoop)` loop in the generator handles this. Each iteration is one API call. Most conversations need 1-2 iterations (one for the initial response, maybe one more after tool use). The AI can chain multiple tool calls if needed.

---

## Implementation Order (suggested)

1. **AnthropicChatBot.ts**: Build `streamMessage()` — the async generator with the tool-use loop
2. **server.ts**: Wire up `/api/chat/send` to consume the generator and produce SSE
3. **ChatView.tsx**: Build the frontend SSE reader that updates messages progressively

Good luck!