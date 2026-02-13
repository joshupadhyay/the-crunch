import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import type { IDatabase, Message } from "./databases/Database";
import type { MessageCreateParams } from "@anthropic-ai/sdk/resources";
import { executeTool, TOOLS } from "./tools";

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
    // Save the user's message to DB
    await this.DATABASE.pushMessage(
      conversationId,
      message.role,
      message.content,
    );

    let stopReason: string | null = "tool_use";

    // TOOL USE LOOP: keep calling the API until Claude stops requesting tools

    // pull up textContent, so when tool use ends we can still save the text from it
    let textContent = "";
    while (stopReason === "tool_use") {
      const messages = await this.DATABASE.getConversation(conversationId);

      const stream = await this.client.messages.create({
        messages: toMessageParams(messages),
        stream: true,
        tools: TOOLS,
        ...this.anthropicApiParams,
      });

      // Track state for this stream iteration
      const toolCalls: { name: string; id: string; input: string }[] = [];
      let currentToolName = "";
      let currentToolId = "";
      let currentToolInput = "";
      stopReason = null;

      for await (const event of stream) {
        // yield* delegates parsed chunks to the frontend (text, tool_use_start, etc.)
        yield* parseMessageStreamEvents(event);

        // ALSO track tool call info for the loop
        // We do this here because parseMessageStreamEvents is sync and can't execute tools
        if (
          event.type === "content_block_start" &&
          event.content_block.type === "tool_use"
        ) {
          // A tool call is starting — capture name + id
          currentToolName = event.content_block.name;
          currentToolId = event.content_block.id;
          currentToolInput = "";
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            textContent += event.delta.text;
          } else if (event.delta.type === "input_json_delta") {
            // Accumulate partial JSON pieces into full input
            currentToolInput += event.delta.partial_json;
          }
        } else if (event.type === "content_block_stop" && currentToolName) {
          // Tool block finished — save the accumulated tool call
          toolCalls.push({
            name: currentToolName,
            id: currentToolId,
            input: currentToolInput,
          });
          currentToolName = "";
          currentToolId = "";
          currentToolInput = "";
        } else if (event.type === "message_delta") {
          // This tells us WHY Claude stopped: "tool_use" or "end_turn"
          stopReason = event.delta.stop_reason;
        }
      }

      // If Claude wants tool results, execute them and save to DB for next iteration
      if (stopReason === "tool_use" && toolCalls.length > 0) {
        // Build the assistant message content blocks (text + tool_use)
        const assistantContent: any[] = [];
        if (textContent) {
          assistantContent.push({ type: "text", text: textContent });
        }
        for (const tc of toolCalls) {
          assistantContent.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: JSON.parse(tc.input || "{}"),
          });
        }

        // Save assistant message with tool_use blocks
        await this.DATABASE.pushMessage(
          conversationId,
          "assistant",
          JSON.stringify(assistantContent),
        );

        // Execute each tool and collect results
        const toolResults: any[] = [];
        for (const tc of toolCalls) {
          const result = await executeTool(
            tc.name,
            JSON.parse(tc.input || "{}"),
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: tc.id,
            content: JSON.stringify(result),
          });
        }

        // Save tool results as a "user" message (Anthropic API requires tool_result in user role)
        await this.DATABASE.pushMessage(
          conversationId,
          "user",
          JSON.stringify(toolResults),
        );

        // Loop continues → new API call with updated messages including tool results
      }
    }

    // already a string, no need to stringify
    if (textContent) {
      await this.DATABASE.pushMessage(conversationId, "assistant", textContent);
    }
  }
}

function* parseMessageStreamEvents(event: Anthropic.RawMessageStreamEvent) {
  switch (event.type) {
    case "message_start":
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
