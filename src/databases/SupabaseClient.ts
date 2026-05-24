import type { IDatabase, Message, Conversation } from "./Database";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export class SupabaseDB implements IDatabase {
  client: SupabaseClient<Database>;

  private constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  static async connect(): Promise<SupabaseDB> {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) throw new Error("Missing env var VITE_SUPABASE_URL");
    if (!key) throw new Error("Missing env var SUPABASE_SERVICE_ROLE_KEY");

    const client = createClient<Database>(url, key);

    // Verify the connection actually works
    const { error } = await client.from("conversations").select("id").limit(1);
    if (error) throw new Error(`Supabase connection failed: ${error.message}`);

    return new SupabaseDB(client);
  }

  async createConversation(userId: string): Promise<Conversation> {
    const { data, error } = await this.client
      .from("conversations")
      .insert({ user_id: userId })
      .select("id, created_at")
      .single();

    if (error) throw error;
    return { id: data.id, createdAt: data.created_at };
  }

  async getAllConversations(userId: string): Promise<Conversation[]> {
    const { data, error } = await this.client
      .from("conversations")
      .select("id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }); // show oldest on top

    if (error) throw error;
    return data.map((row) => ({ id: row.id, createdAt: row.created_at }));
  }

  /** @returns Message[] for entire conversation */
  async getConversation(
    conversationId: string,
    userId: string,
  ): Promise<Message[]> {
    const { data, error } = await this.client
      .from("messages")
      .select("role, content, conversations!inner(user_id)")
      .eq("conversation_id", conversationId)
      .eq("conversations.user_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data.map((row) => ({
      role: row.role as Message["role"],
      content:
        typeof row.content === "string"
          ? row.content
          : JSON.stringify(row.content),
    }));
  }

  async pushMessage(
    id: string,
    userId: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<Message[]> {
    await this.getConversation(id, userId);

    const { error } = await this.client.from("messages").insert({
      conversation_id: id,
      role,
      content,
    });

    if (error) throw error;
    return this.getConversation(id, userId);
  }
}
