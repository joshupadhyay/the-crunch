import Anthropic from "@anthropic-ai/sdk";
import { CHATDATABASE } from "./Database";
import { randomUUIDv7 } from "bun";
import { SYSTEM_PROMPT } from "./system-prompt";
import { TOOLS, executeTool } from "./tools";
import type {
  MessageCreateParams,
  MessageParam,
} from "@anthropic-ai/sdk/resources";

export interface StreamEvent {
  type: "text" | "tool_start" | "tool_result" | "done" | "error";
  text?: string;
  name?: string;
  message?: string;
}

export class AnthropicChatBot {
  DATABASE: typeof CHATDATABASE;
  readonly client: Anthropic;

  params: Pick<MessageCreateParams, "max_tokens" | "model"> = {
    max_tokens: 4096,
    model: "claude-sonnet-4-5-20250929",
  };

  constructor(database: typeof CHATDATABASE) {
    this.DATABASE = database;
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? "NO KEY DEFINED",
    });
  }

  createConversation(): string {
    const newConversationID = randomUUIDv7().toString();
    this.DATABASE.set(newConversationID, []);
    return newConversationID;
  }

  async *streamMessage(
    conversationId: string,
    userMessage: string
  ): AsyncGenerator<StreamEvent> {
    const messages = this.DATABASE.get(conversationId);
    if (!messages) {
      yield { type: "error", message: "Conversation ID not found" };
      return;
    }

    messages.push({ role: "user", content: userMessage });

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

      // Add assistant response to conversation history
      messages.push({ role: "assistant", content: finalMessage.content });

      if (finalMessage.stop_reason === "tool_use") {
        const toolUseBlocks = finalMessage.content.filter(
          (block) => block.type === "tool_use"
        );

        // Notify client about tool execution
        const toolNames = toolUseBlocks
          .map((t) => (t.type === "tool_use" ? t.name : ""))
          .filter(Boolean)
          .join(", ");
        yield { type: "tool_start", name: toolNames };

        // Execute all tool calls (some may be async like OpenTable)
        const toolResultContent = await Promise.all(
          toolUseBlocks.map(async (toolUse) => {
            if (toolUse.type !== "tool_use") return toolUse as any;
            const result = await executeTool(
              toolUse.name,
              toolUse.input as Record<string, unknown>
            );
            return {
              type: "tool_result" as const,
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            };
          })
        );

        const toolResults: MessageParam = {
          role: "user",
          content: toolResultContent,
        };

        messages.push(toolResults);
        yield { type: "tool_result" };
        // Loop continues — next iteration streams the post-tool response
      } else {
        continueLoop = false;
      }
    }

    yield { type: "done" };
  }
}
