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
  createConversation(userId: string): Promise<Conversation>;

  /** @returns Message[] for entire conversation */
  getConversation(conversationId: string, userId: string): Promise<Message[]>;

  getAllConversations(userId: string): Promise<Conversation[]>;

  pushMessage(
    id: string,
    userId: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<Message[]>;

  deleteConversation?(id: string, userId: string): Promise<void>;
}

export class LocalMapDB implements IDatabase {
  private store = new Map<
    string,
    { createdAt: string; userId: string; messages: Message[] }
  >();

  async createConversation(userId: string): Promise<Conversation> {
    const id = randomUUIDv7().toString();
    const createdAt = new Date().toISOString();
    this.store.set(id, { createdAt, userId, messages: [] });
    return { id, createdAt };
  }

  /** @returns Message[] for entire conversation */
  async getConversation(
    conversationId: string,
    userId: string,
  ): Promise<Message[]> {
    const entry = this.store.get(conversationId);
    if (!entry || entry.userId !== userId) {
      throw new Error(`Conversation ${conversationId} does not exist.`);
    }
    return entry.messages;
  }

  async getAllConversations(userId: string): Promise<Conversation[]> {
    return Array.from(this.store.entries())
      .filter(([, entry]) => entry.userId === userId)
      .map(([id, { createdAt }]) => ({
        id,
        createdAt,
      }));
  }

  async pushMessage(
    id: string,
    userId: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<Message[]> {
    const messages = await this.getConversation(id, userId);
    messages.push({ role, content });
    return messages;
  }
}
