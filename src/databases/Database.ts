import { randomUUIDv7 } from "bun";

// Domain types — no SDK imports
export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type Conversation = {
  id: string;
  createdAt: string;
};

export interface IDatabase {
  createConversation(): Promise<Conversation>;

  /** @returns Message[] for entire conversation */
  getConversation(conversationId: string): Promise<Message[]>;

  getAllConversations(): Promise<Conversation[]>;

  pushMessage(
    id: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<Message[]>;

  deleteConversation?(id: string): Promise<void>;
}

export class LocalMapDB implements IDatabase {
  private store = new Map<string, { createdAt: string; messages: Message[] }>();

  async createConversation(): Promise<Conversation> {
    const id = randomUUIDv7().toString();
    const createdAt = new Date().toISOString();
    this.store.set(id, { createdAt, messages: [] });
    return { id, createdAt };
  }

  /** @returns Message[] for entire conversation */
  async getConversation(conversationId: string): Promise<Message[]> {
    const entry = this.store.get(conversationId);
    if (!entry) {
      throw new Error(`Conversation ${conversationId} does not exist.`);
    }
    return entry.messages;
  }

  async getAllConversations(): Promise<Conversation[]> {
    return Array.from(this.store.entries()).map(([id, { createdAt }]) => ({
      id,
      createdAt,
    }));
  }

  async pushMessage(
    id: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<Message[]> {
    const messages = await this.getConversation(id);
    messages.push({ role, content });
    return messages;
  }
}
