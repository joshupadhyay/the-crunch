import type { MessageParam } from "@anthropic-ai/sdk/resources";
import { randomUUIDv7 } from "bun";

export const CHATDATABASE: Map<string, MessageParam[]> = new Map();

export interface DatabaseInterface {
  createConversation(): string;

  getConversation(id: string): MessageParam[];

  pushMessage(
    id: string,
    role: "user" | "assistant",
    message: string,
  ): MessageParam[];

  // this is how you specify optional function in interface
  deleteConversation?(id: string): void;
}

export class LocalStorage implements DatabaseInterface {
  CHATDATABASE: Map<string, MessageParam[]> = new Map();

  createConversation(): string {
    const newConversationID = randomUUIDv7().toString();
    CHATDATABASE.set(newConversationID, []);
    return newConversationID;
  }

  getConversation(id: string) {
    const messages = CHATDATABASE.get(id);

    if (!messages) {
      throw new Error(`Conversation ${messages} does not exist.`);
    }
    return messages;
  }

  pushMessage(
    id: string,
    role: "user" | "assistant",
    message: string,
  ): MessageParam[] {
    const messages = this.getConversation(id);

    messages?.push({ role: role, content: message });

    return messages;
  }
}
