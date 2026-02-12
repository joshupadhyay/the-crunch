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
        const body = await req.json();

        const { message, conversationId } = body;

        const stream = new ReadableStream({
          // we create a new readable stream

          // start is to start the stream. We use the stream controller to grab chunks from the streamMessage
          async start(controller) {
            for await (const chunk of chatbot.streamMessage(
              { role: "user", content: message }, // take message from user and pass it to ChatBot
              conversationId,
            )) {
              // We take the output from the chatbot, and stringify it...
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify(chunk) + "\n"),
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
