import type { IDatabase, Message, Conversation } from "./Database";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export class SupabaseDB implements IDatabase {
  client: SupabaseClient<Database>;

  constructor() {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
    );
    this.client = supabase;
  }

  async createConversation(): Promise<Conversation> {
    const { data, error } = await this.client
      .from("conversations")
      .insert({ user_id: "anonymous" })
      .select("id, created_at")
      .single();

    if (error) throw error;
    return { id: data.id, createdAt: data.created_at };
  }

  async getAllConversations(): Promise<Conversation[]> {
    const { data, error } = await this.client
      .from("conversations")
      .select("id, created_at")
      .order("created_at");

    if (error) throw error;
    return data.map((row) => ({ id: row.id, createdAt: row.created_at }));
  }

  async getConversation(id: string): Promise<Message[]> {
    const { data, error } = await this.client
      .from("messages")
      .select("role, content")
      .eq("conversation_id", id);

    if (error) throw error;
    return data.map((row) => ({
      role: row.role as Message["role"],
      content: typeof row.content === "string" ? row.content : JSON.stringify(row.content),
    }));
  }

  async pushMessage(
    id: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<Message[]> {
    const { error } = await this.client.from("messages").insert({
      conversation_id: id,
      role,
      content,
    });

    if (error) throw error;
    return this.getConversation(id);
  }
}
