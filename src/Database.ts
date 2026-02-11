import type { MessageParam } from "@anthropic-ai/sdk/resources";
import { randomUUIDv7 } from "bun";

export const CHATDATABASE: Map<string, MessageParam[]> = new Map();

export interface IDatabase {
  createConversation(): string;

  getConversation(id: string): MessageParam[];

  getAllConversations(): string[];

  // this might be expensive to return the messages after a push?
  // Maybe just a confirmation of successful db transaction = more performant.
  pushMessage(
    id: string,
    role: "user" | "assistant",
    message: MessageParam["content"],
  ): MessageParam[];

  // this is how you specify optional function in interface
  deleteConversation?(id: string): void;
}

export class LocalMapDB implements IDatabase {
  CHATDATABASE: Map<string, MessageParam[]> = new Map();

  createConversation(): string {
    const newConversationID = randomUUIDv7().toString();
    this.CHATDATABASE.set(newConversationID, []);
    return newConversationID;
  }

  getConversation(id: string) {
    const messages = this.CHATDATABASE.get(id);

    if (!messages) {
      throw new Error(`Conversation ${id} does not exist.`);
    }
    return messages;
  }

  /**
   *
   * @returns string[] of all conversationIDs
   */
  getAllConversations(): string[] {
    return this.CHATDATABASE.keys().toArray();
  }

  pushMessage(
    id: string,
    role: "user" | "assistant",
    message: MessageParam["content"],
  ): MessageParam[] {
    const messages = this.getConversation(id);

    messages?.push({ role: role, content: message });

    return messages;
  }
}
