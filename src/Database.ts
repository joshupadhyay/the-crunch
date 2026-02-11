import type { MessageParam } from "@anthropic-ai/sdk/resources";
import { randomUUIDv7 } from "bun";

export const CHATDATABASE: Map<string, MessageParam[]> = new Map();

export interface IDatabase {
  createConversation(): Promise<string>;

  getConversation(id: string): Promise<MessageParam[]>;

  getAllConversations(): Promise<string[]>;

  // this might be expensive to return the messages after a push?
  // Maybe just a confirmation of successful db transaction = more performant.
  pushMessage(
    id: string,
    role: "user" | "assistant",
    message: MessageParam["content"],
  ): Promise<MessageParam[]>;

  // this is how you specify optional function in interface
  deleteConversation?(id: string): void;
}

export class LocalMapDB implements IDatabase {
  CHATDATABASE: Map<string, MessageParam[]> = new Map();

  async createConversation() {
    const newConversationID = randomUUIDv7().toString();
    CHATDATABASE.set(newConversationID, []);
    return await newConversationID;
  }

  async getConversation(id: string) {
    const messages = CHATDATABASE.get(id);

    if (!messages) {
      throw new Error(`Conversation ${messages} does not exist.`);
    }
    return messages;
  }

  /**
   *
   * @returns string[] of all conversationIDs
   */
  async getAllConversations() {
    return await CHATDATABASE.keys().toArray();
  }

  async pushMessage(
    id: string,
    role: "user" | "assistant",
    message: MessageParam["content"],
  ): Promise<MessageParam[]> {
    const messages = await this.getConversation(id);

    messages?.push({ role: role, content: message });

    return messages;
  }
}
