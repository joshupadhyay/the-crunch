import { serve } from "bun";
import index from "./index.html";
import { AnthropicChatBot } from "./AnthropicChatBot";
import { createDatabase } from "./databases/createDatabase";
import type { Message } from "./databases/Database";
import { auth } from "./auth-client";
import { isLangfuseFeedbackEnabled, postUserFeedback } from "./langfuse-feedback";

/**
 * Init Chatbot with the configured persistent store.
 */
const db = await createDatabase();
const chatbot = new AnthropicChatBot(db);

export const server = serve({
  routes: {
    "/*": index,

    "/api/mapbox-token": {
      async GET(req) {
        try { await authCheck(req); }
        catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }

        const token = process.env.MAPBOX_ACCESS_TOKEN;
        if (!token) {
          return Response.json({ error: "MAPBOX_ACCESS_TOKEN not set" }, { status: 500 });
        }
        return Response.json({ token });
      },
    },

    "/api/chat/feedback": {
      async POST(req) {
        let userId: string;
        try {
          userId = await authCheck(req);
        } catch {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!isLangfuseFeedbackEnabled()) {
          return Response.json(
            { error: "Feedback is not configured" },
            { status: 503 },
          );
        }

        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { traceId, score, comment, conversationId } = body as {
          traceId?: unknown;
          score?: unknown;
          comment?: unknown;
          conversationId?: unknown;
        };

        if (typeof traceId !== "string" || (score !== 0 && score !== 1)) {
          return Response.json(
            { error: "traceId and score (0 or 1) are required" },
            { status: 400 },
          );
        }

        const result = await postUserFeedback({
          traceId,
          score,
          comment: typeof comment === "string" ? comment : undefined,
          conversationId:
            typeof conversationId === "string" ? conversationId : undefined,
          userId,
        });

        if (!result.ok) {
          const status =
            result.reason === "invalid"
              ? 400
              : result.reason === "disabled"
                ? 503
                : 502;
          return Response.json(
            { error: result.detail ?? "Could not save feedback" },
            { status },
          );
        }

        return Response.json({ ok: true, scoreId: result.scoreId });
      },
    },

    "/api/chat/create": {
      async POST(req) {
        try { await authCheck(req); }
        catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }

        const conversation = await chatbot.DATABASE.createConversation();
        return Response.json(conversation);
      },
    },

    "/api/chat/conversations": {
      async GET(req) {
        try { await authCheck(req); }
        catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }

        const conversations = await chatbot.DATABASE.getAllConversations();

        const result = await Promise.all(
          conversations.map(async (conv) => {
            const messages = await chatbot.DATABASE.getConversation(conv.id);
            const firstUserMsg = messages.find((m) => m.role === "user");
            const preview = firstUserMsg
              ? firstUserMsg.content.slice(0, 60)
              : "New conversation";
            return {
              id: conv.id,
              createdAt: conv.createdAt,
              preview,
              messageCount: messages.length,
            };
          }),
        );

        return Response.json(result);
      },
    },

    "/api/chat/conversations/:id": {
      async GET(req) {
        try { await authCheck(req); }
        catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }

        const id = req.params.id;
        try {
          const resp = await chatbot.DATABASE.getConversation(id);
          const messages = toDisplayMessages(resp);
          return Response.json(messages);
        } catch {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
      },
    },

    // Let BetterAuth handle the auth for us!
    "/api/auth/*": async (req) => {
      return auth.handler(req);
    },

    "/api/chat/send": {
      async POST(req) {
        try { await authCheck(req); }
        catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }

        const body = await req.json();

        const { message, conversationId } = body;

        const stream = new ReadableStream({
          // we create a new readable stream

          // start is to start the stream. We use the stream controller to grab chunks from the streamMessage
          async start(controller) {
            try {
              for await (const chunk of chatbot.streamMessage(
                { role: "user", content: message }, // take message from user and pass it to ChatBot
                conversationId,
              )) {
                // We take the output from the chatbot, and stringify it...
                controller.enqueue(
                  new TextEncoder().encode(JSON.stringify(chunk) + "\n"),
                );
              }
            } catch (err: any) {
              // Send error as a stream chunk so the frontend can display it
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({
                    type: "error",
                    message: err.message ?? "Something went wrong",
                  }) + "\n",
                ),
              );
            }

            // no more chunks (response is complete, we close the controller)
            controller.close();
          },
        });

        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream" },
        });

        /**
         * We are STREAMING - we can't just return an object. But Response can accept a streaming object
         */
        // return await chatbot.streamMessage(message, conversationId);
      },
    },
  },

  idleTimeout: 60, // seconds — SSE streams need longer than the 10s default

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

/**
 * Converts raw DB messages into display-friendly messages.
 * - Plain text messages: kept as-is
 * - JSON array messages (tool use): extracts text from {type:"text"} blocks
 * - Pure tool_result messages (no text): dropped entirely
 */
function toDisplayMessages(messages: Message[]): Message[] {
  return messages.flatMap((msg) => {
    try {
      const parsed = JSON.parse(msg.content);
      if (!Array.isArray(parsed)) return [msg];

      const text = parsed
        .filter((block: any) => block.type === "text")
        .map((block: any) => block.text)
        .join("");

      if (!text) return []; // pure tool_result, drop it
      return [{ role: msg.role, content: text }];
    } catch {
      return [msg]; // plain text, keep as-is
    }
  });
}

/**
 *
 * @param req
 * @returns
 */
async function authCheck(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user?.id) {
    throw new Error("401 unauthorized");
  }

  return session.user.id;
}
