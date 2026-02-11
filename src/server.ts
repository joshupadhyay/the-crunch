import { serve } from "bun";
import index from "./index.html";
import { AnthropicChatBot } from "./AnthropicChatBot";
import { SupabaseDB } from "./databases/SupabaseClient";

/**
 * Init Chatbot, with Supabase Database
 */
const db = await SupabaseDB.connect();
const chatbot = new AnthropicChatBot(db);

export const server = serve({
  routes: {
    "/*": index,

    "/api/chat/create": {
      async POST() {
        const conversation = await chatbot.DATABASE.createConversation();
        return Response.json(conversation);
      },
    },

    "/api/chat/conversations": {
      async GET() {
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
        const id = req.params.id;
        try {
          const messages = await chatbot.DATABASE.getConversation(id);
          return Response.json(messages);
        } catch {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
      },
    },

    "/api/chat/send": {
      async POST(req) {
        const { conversationId, message } = await req.json();

        const readable = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            try {
              for await (const event of chatbot.streamMessage(
                conversationId,
                message,
              )) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
                );
              }
            } catch (err: any) {
              console.error("[send] Stream error:", err);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`,
                ),
              );
            } finally {
              controller.close();
            }
          },
        });

        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});
