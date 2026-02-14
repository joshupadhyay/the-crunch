import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import type { IDatabase, Message } from "./databases/Database";
import type { MessageCreateParams } from "@anthropic-ai/sdk/resources";
import { executeTool, TOOLS } from "./tools";
import { SYSTEM_PROMPT } from "./system-prompt";

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

interface ToolCall {
  name: string;
  id: string;
  input: Record<string, unknown>;
}

/** What consumeStream collects while yielding frontend events */
interface StreamResult {
  textContent: string;
  toolCalls: ToolCall[];
  stopReason: string | null;
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
    return this.DATABASE.createConversation();
  }

  async getMessages(conversationId: string) {
    return this.DATABASE.getConversation(conversationId);
  }

  /**
   * Orchestrator — sends a message and streams the response.
   * Loops until Claude stops requesting tools.
   */
  async *streamMessage(message: Message, conversationId: string) {
    // User message comes in, push it to the DB immediately
    await this.DATABASE.pushMessage(
      conversationId,
      message.role,
      message.content,
    );

    // define the break condition of the while loop
    let stopReason: string | null = "tool_use";

    // While the conversation is ongoing, pull latest messages, start streaming
    while (stopReason === "tool_use") {
      const messages = await this.DATABASE.getConversation(conversationId);

      const stream = await this.client.messages.create({
        system: SYSTEM_PROMPT,
        messages: toMessageParams(messages),
        stream: true,
        tools: TOOLS,
        ...this.anthropicApiParams,
      });

      // yield* delegates frontend events AND captures the return value
      const result = yield* this.consumeStream(stream);
      stopReason = result.stopReason;

      // If the stream pauses for tool use, we handle it. We have many tools with formats!
      if (stopReason === "tool_use" && result.toolCalls.length > 0) {
        await this.persistAssistantToolUse(conversationId, result);
        yield* this.executeAndPersistTools(conversationId, result.toolCalls);
      } else if (result.textContent) {
        // if just text, push the AI's text straight to the DB
        await this.DATABASE.pushMessage(
          conversationId,
          "assistant",
          result.textContent,
        );
      }
    }
  }

  /**
   * Consumes the Anthropic stream event by event.
   * Yields frontend events (text chunks, tool_use_start/stop) as they arrive.
   * Returns the collected StreamResult when the stream ends.
   */
  private async *consumeStream(
    stream: AsyncIterable<Anthropic.RawMessageStreamEvent>,
  ): AsyncGenerator<unknown, StreamResult> {
    const toolCalls: ToolCall[] = [];
    let currentToolName = "";
    let currentToolId = "";
    let currentToolInput = "";
    let textContent = "";
    let stopReason: string | null = null;

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          currentToolName = event.content_block.name;
          currentToolId = event.content_block.id;
          currentToolInput = "";
          yield {
            type: "tool_use_start",
            name: currentToolName,
            id: currentToolId,
          };
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          textContent += event.delta.text;
          yield { type: "text", text: event.delta };
        } else if (event.delta.type === "input_json_delta") {
          currentToolInput += event.delta.partial_json;
          yield { type: "tool_input", partial_json: event.delta.partial_json };
        }
      } else if (event.type === "content_block_stop") {
        if (currentToolName) {
          toolCalls.push({
            name: currentToolName,
            id: currentToolId,
            input: JSON.parse(currentToolInput || "{}"),
          });
          currentToolName = "";
          currentToolId = "";
          currentToolInput = "";
          yield { type: "tool_use_stop" };
        }
      } else if (event.type === "message_delta") {
        stopReason = event.delta.stop_reason;
      }
    }

    return { textContent, toolCalls, stopReason };
  }

  /**
   * Saves the assistant's response (text + tool_use blocks) to the DB
   * so the next API call has the full conversation history.
   *
   * Tools have a different format, so we treat and handle them
   */
  private async persistAssistantToolUse(
    conversationId: string,
    result: StreamResult,
  ) {
    const content: MessageParam["content"] = [];
    if (result.textContent) {
      content.push({ type: "text", text: result.textContent });
    }
    for (const tc of result.toolCalls) {
      content.push({
        type: "tool_use",
        id: tc.id,
        name: tc.name,
        input: tc.input,
      });
    }
    await this.DATABASE.pushMessage(
      conversationId,
      "assistant",
      JSON.stringify(content),
    );
  }

  /**
   * Executes each tool call, yields results to the frontend (e.g. geocode_results),
   * and saves tool_result messages to the DB for the next API iteration.
   */
  private async *executeAndPersistTools(
    conversationId: string,
    toolCalls: ToolCall[],
  ) {
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const tc of toolCalls) {
      const result = await executeTool(tc.name, tc.input);

      // Stream geocode results directly to the frontend for map rendering
      if (tc.name === "geocode_venues") {
        yield { type: "geocode_results", venues: result };
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: tc.id,
        content: JSON.stringify(result),
      });
    }

    // Anthropic API requires tool_result in user role
    await this.DATABASE.pushMessage(
      conversationId,
      "user",
      JSON.stringify(toolResults),
    );
  }
}
