import { serve } from "bun";
import index from "./index.html";
import { AnthropicChatBot } from "./AnthropicChatBot";
import { SupabaseDB } from "./databases/SupabaseClient";
import type { Message } from "./databases/Database";
import { auth } from "./auth-client";

/**
 * Init Chatbot, with Supabase Database
 */
const db = await SupabaseDB.connect();
const chatbot = new AnthropicChatBot(db);

export const server = serve({
  routes: {
    "/*": index,

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

  if (!session) {
    throw new Error("401 unauthorized");
  }
}
