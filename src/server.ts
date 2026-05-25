import { serve } from "bun";
import index from "./index.html";
import { AnthropicChatBot } from "./AnthropicChatBot";
import { createDatabase } from "./databases/createDatabase";
import type { Message } from "./databases/Database";
import { auth } from "./auth-client";
import { captureServerException } from "./observability";

const TRIAL_MESSAGE_LIMIT = 15;

/**
 * Init Chatbot with the configured persistent store.
 */
const db = await createDatabase();
const chatbot = new AnthropicChatBot(db);

export const server = serve({
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/*": index,

    "/api/client-config": {
      GET() {
        return Response.json({
          sentry: {
            dsn: process.env.PUBLIC_SENTRY_DSN,
            environment:
              process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
            release: process.env.SENTRY_RELEASE,
            tracesSampleRate: parseSampleRate(
              "PUBLIC_SENTRY_TRACES_SAMPLE_RATE",
              0,
            ),
            replaysSessionSampleRate: parseSampleRate(
              "PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE",
              0,
            ),
            replaysOnErrorSampleRate: parseSampleRate(
              "PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE",
              0,
            ),
          },
        });
      },
    },

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

    "/api/chat/create": {
      async POST(req) {
        let userId: string;
        try { userId = await authCheck(req); }
        catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }

        const conversation = await chatbot.DATABASE.createConversation(userId);
        return Response.json(conversation);
      },
    },

    "/api/chat/conversations": {
      async GET(req) {
        let userId: string;
        try { userId = await authCheck(req); }
        catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }

        const conversations = await chatbot.DATABASE.getAllConversations(userId);

        const result = await Promise.all(
          conversations.map(async (conv) => {
            const messages = await chatbot.DATABASE.getConversation(
              conv.id,
              userId,
            );
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
        let userId: string;
        try { userId = await authCheck(req); }
        catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }

        const id = req.params.id;
        try {
          const resp = await chatbot.DATABASE.getConversation(id, userId);
          const messages = toDisplayMessages(resp);
          return Response.json(messages);
        } catch {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
      },
    },

    // Let BetterAuth handle the auth for us.
    "/api/auth/*": {
      OPTIONS(req) {
        return authPreflight(req);
      },
      GET(req) {
        return auth.handler(req);
      },
      POST(req) {
        return auth.handler(req);
      },
    },

    "/api/chat/send": {
      async POST(req) {
        let userId: string;
        try { userId = await authCheck(req); }
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
                userId,
                {
                  userId,
                  sessionId: conversationId,
                  traceName: "authenticated-chat-message",
                  tags: ["authenticated"],
                  metadata: {
                    chatId: conversationId,
                    chatType: "authenticated",
                  },
                },
              )) {
                // We take the output from the chatbot, and stringify it...
                controller.enqueue(
                  new TextEncoder().encode(JSON.stringify(chunk) + "\n"),
                );
              }
            } catch (err: any) {
              captureServerException(err, {
                route: "/api/chat/send",
                conversationId,
              });

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

    "/api/trial/chat/create": {
      async POST(req) {
        const body = await req.json().catch(() => ({}));
        const trialId = getTrialId(req, body);
        if (!trialId) {
          return Response.json({ error: "Missing trial id" }, { status: 400 });
        }

        const userId = trialUserId(trialId);
        const existing = await chatbot.DATABASE.getAllConversations(userId);
        if (existing[0]) return Response.json(existing[0]);

        const conversation = await chatbot.DATABASE.createConversation(userId);
        return Response.json(conversation);
      },
    },

    "/api/trial/chat/conversations/:id": {
      async GET(req) {
        const trialId = getTrialId(req);
        if (!trialId) {
          return Response.json({ error: "Missing trial id" }, { status: 400 });
        }

        try {
          const resp = await chatbot.DATABASE.getConversation(
            req.params.id,
            trialUserId(trialId),
          );
          return Response.json(toDisplayMessages(resp));
        } catch {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
      },
    },

    "/api/trial/chat/send": {
      async POST(req) {
        const body = await req.json().catch(() => ({}));
        const trialId = getTrialId(req, body);
        const { message, conversationId } = body;

        if (!trialId || typeof message !== "string" || typeof conversationId !== "string") {
          return Response.json({ error: "Invalid trial request" }, { status: 400 });
        }

        const userId = trialUserId(trialId);
        const history = await chatbot.DATABASE.getConversation(conversationId, userId);
        const usedMessages = history.filter((msg) => msg.role === "user" && !isToolResultMessage(msg)).length;

        if (usedMessages >= TRIAL_MESSAGE_LIMIT) {
          return Response.json(
            {
              error: `Trial limit reached. Sign up to keep chatting after ${TRIAL_MESSAGE_LIMIT} messages.`,
              limit: TRIAL_MESSAGE_LIMIT,
              used: usedMessages,
            },
            { status: 429 },
          );
        }

        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of chatbot.streamMessage(
                { role: "user", content: message },
                conversationId,
                userId,
                {
                  userId,
                  sessionId: `trial:${trialId}`,
                  traceName: "trial-chat-message",
                  tags: ["trial"],
                  metadata: {
                    chatId: conversationId,
                    chatType: "trial",
                    trialId,
                    trialMessageLimit: String(TRIAL_MESSAGE_LIMIT),
                    trialMessageNumber: String(usedMessages + 1),
                  },
                },
              )) {
                controller.enqueue(
                  new TextEncoder().encode(JSON.stringify(chunk) + "\n"),
                );
              }
            } catch (err: any) {
              captureServerException(err, {
                route: "/api/trial/chat/send",
                conversationId,
                trialId,
              });
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({
                    type: "error",
                    message: err.message ?? "Something went wrong",
                  }) + "\n",
                ),
              );
            }

            controller.close();
          },
        });

        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream" },
        });
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

function parseSampleRate(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 0), 1);
}

function getTrialId(req: Request, body?: Record<string, unknown>) {
  const trialId = req.headers.get("x-trial-id") ?? body?.trialId;
  if (typeof trialId !== "string") return undefined;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trialId)) {
    return undefined;
  }
  return trialId;
}

function trialUserId(trialId: string) {
  return `trial:${trialId}`;
}

function isToolResultMessage(message: Message) {
  try {
    const parsed = JSON.parse(message.content);
    return Array.isArray(parsed) && parsed.every((block) => block?.type === "tool_result");
  } catch {
    return false;
  }
}

function authPreflight(req: Request) {
  const origin = req.headers.get("origin");
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      req.headers.get("access-control-request-headers") ??
      "content-type,authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "600",
  });

  if (origin && isTrustedBrowserOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.append("Vary", "Origin");
  }

  return new Response(null, { status: 204, headers });
}

function isTrustedBrowserOrigin(origin: string) {
  if (origin === "http://localhost:3000") return true;
  if (origin === process.env.BETTER_AUTH_URL) return true;

  return (
    process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
      .map((candidate) => candidate.trim())
      .filter(Boolean)
      .includes(origin) ?? false
  );
}
