import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import type { IDatabase, Message } from "./databases/Database";
import { SYSTEM_PROMPT } from "./system-prompt";
import { TOOLS, executeTool } from "./tools";
import type { MessageCreateParams } from "@anthropic-ai/sdk/resources";

export interface StreamEvent {
  type: "text" | "tool_start" | "tool_result" | "done" | "error";
  text?: string;
  name?: string;
  message?: string;
}

// TODO
// What about tool calls? is this stored as JSONB? Is it better to be as text?
// You will come back, this will bite you in the ass for sure...
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

  params: Pick<MessageCreateParams, "max_tokens" | "model"> = {
    max_tokens: 4096,
    // SAVE MONEY – DO NOT CHANGE THE MODEL TYPE
    model: "claude-haiku-4-5-20251001",
  };

  constructor(database: IDatabase) {
    this.DATABASE = database;
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? "NO KEY DEFINED",
    });
  }

  async *streamMessage(
    conversationId: string,
    userMessage: string,
  ): AsyncGenerator<StreamEvent> {
    // Store user message and build SDK messages
    await this.DATABASE.pushMessage(conversationId, "user", userMessage);
    const domainMessages = await this.DATABASE.getConversation(conversationId);
    const messages: MessageParam[] = toMessageParams(domainMessages);

    let continueLoop = true;

    while (continueLoop) {
      const stream = this.client.messages.stream({
        ...this.params,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      // Stream text deltas to the client
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield { type: "text", text: event.delta.text };
        }
      }

      const finalMessage = await stream.finalMessage();

      // Store assistant response as serialized string
      const serialized = serializeContent(finalMessage.content);
      await this.DATABASE.pushMessage(conversationId, "assistant", serialized);
      // Also push to local messages array for the SDK loop
      messages.push({ role: "assistant", content: finalMessage.content });

      if (finalMessage.stop_reason === "tool_use") {
        const toolUseBlocks = finalMessage.content.filter(
          (block) => block.type === "tool_use",
        );

        // Notify client about tool execution
        const toolNames = toolUseBlocks
          .map((t) => (t.type === "tool_use" ? t.name : ""))
          .filter(Boolean)
          .join(", ");
        yield { type: "tool_start", name: toolNames };

        // Execute all tool calls
        const toolResultContent = await Promise.all(
          toolUseBlocks.map(async (toolUse) => {
            if (toolUse.type !== "tool_use") return toolUse as any;
            const result = await executeTool(
              toolUse.name,
              toolUse.input as Record<string, unknown>,
            );
            return {
              type: "tool_result" as const,
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            };
          }),
        );

        // Store tool results and push to SDK messages
        await this.DATABASE.pushMessage(
          conversationId,
          "user",
          JSON.stringify(toolResultContent),
        );
        messages.push({ role: "user", content: toolResultContent });

        yield { type: "tool_result" };
        // Loop continues — next iteration streams the post-tool response
      } else {
        continueLoop = false;
      }
    }

    yield { type: "done" };
  }
}
