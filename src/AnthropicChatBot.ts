import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import type { IDatabase, Message } from "./databases/Database";
import type { MessageCreateParams } from "@anthropic-ai/sdk/resources";
import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk";
import { TOOLS } from "./tools";

/** Convert domain Message[] to Anthropic SDK MessageParam[] */
function toMessageParams(messages: Message[]): MessageParam[] {
  return messages.map((m) => {
    let content: MessageParam["content"];
    try {
      content = JSON.parse(m.content);
    } catch {
      content = m.content;
    }
    return { role: m.role, content };
  });
}

/** Serialize SDK content to a string for storage */
function serializeContent(content: MessageParam["content"]): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

export class AnthropicChatBot {
  DATABASE: IDatabase;
  readonly client: Anthropic;

  anthropicApiParams: Pick<MessageCreateParams, "max_tokens" | "model"> = {
    max_tokens: 4096,
    // SAVE MONEY – DO NOT CHANGE THE MODEL TYPE
    model: "claude-haiku-4-5-20251001",
  };

  constructor(database: IDatabase) {
    this.DATABASE = database;
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? "NO KEY DEFINED",
    });
  }

  async createConversation() {
    const conversationCreate = await this.DATABASE.createConversation();

    return conversationCreate;
  }

  async getMessages(conversationId: string) {
    const messages = await this.DATABASE.getConversation(conversationId);

    return messages;
  }

  async *streamMessage(message: Message, conversationId: string) {
    // assume we have latest messages already

    await this.DATABASE.pushMessage(
      conversationId,
      message.role,
      message.content,
    );

    const messages = await this.DATABASE.getConversation(conversationId);

    const stream = await this.client.messages.create({
      messages: toMessageParams(messages),
      stream: true,
      tools: TOOLS,
      ...this.anthropicApiParams,
    });

    for await (const messageStreamEvent of stream) {
      // yield* means we return the yielded values, not the generator iterator obj
      // this is because we have generator in generators
      yield* parseMessageStreamEvents(messageStreamEvent);

      console.log("results", messageStreamEvent);
    }
  }
}

function* parseMessageStreamEvents(event: Anthropic.RawMessageStreamEvent) {
  switch (event.type) {
    case "message_start":
      console.log('message starting"');
      break;

    case "content_block_delta":
      if (event.delta.type === "text_delta") {
        yield { type: "text", text: event.delta };
      } else if (event.delta.type === "input_json_delta") {
        yield { type: "tool_input", partial_json: event.delta.partial_json };
      }
      break;
    case "content_block_start":
      if (event.content_block.type === "tool_use") {
        // a tool call is starting — you get the tool name and id here
        yield {
          type: "tool_use_start",
          name: event.content_block.name,
          id: event.content_block.id,
        };
      }
      break;
    case "content_block_stop":
      // a tool call is ending
      yield {
        type: "tool_use_stop",
      };

      break;
  }
}

// "message_start" | "message_delta" | "message_stop" | "content_block_start" | "content_block_delta" | "content_block_stop"
