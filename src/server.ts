import { serve } from "bun";
import index from "./index.html";
import { AnthropicChatBot } from "./AnthropicChatBot";
import { LocalMapDB } from "./Database";

/**
 * Init Chatbot, with Local Map Database
 */
const chatbot = new AnthropicChatBot(new LocalMapDB());

export const server = serve({
  routes: {
    "/*": index,

    "/api/chat/create": {
      async POST() {
        const id = chatbot.DATABASE.createConversation();
        return Response.json(id);
      },
    },

    "/api/chat/conversations": {
      GET() {
        const conversations: {
          id: string;
          preview: string;
          messageCount: number;
        }[] = [];
        for (const id of chatbot.DATABASE.getAllConversations()) {
          const messages = chatbot.DATABASE.getConversation(id);
          const firstUserMsg = messages.find((m) => m.role === "user");
          const preview = firstUserMsg
            ? typeof firstUserMsg.content === "string"
              ? firstUserMsg.content.slice(0, 60)
              : "..."
            : "New conversation";
          conversations.push({ id, preview, messageCount: messages.length });
        }
        return Response.json(conversations);
      },
    },

    "/api/chat/conversations/:id": {
      GET(req) {
        const id = req.params.id;
        const messages = chatbot.DATABASE.getConversation(id);
        if (!messages) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        return Response.json(messages);
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
