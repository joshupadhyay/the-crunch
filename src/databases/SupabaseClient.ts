import type { IDatabase } from "@/Database";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { MessageParam } from "@anthropic-ai/sdk/resources";

export class SupabaseDB implements IDatabase {
  client: SupabaseClient<Database>;

  constructor() {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY,
    );
    this.client = supabase;
  }

  async getAllConversations() {
    const { data, error } = await this.client
      .from("conversations") // RLS will return only matching conversations with user id
      .select("id, created_at")
      .order("created_at");

    if (error) throw error;

    return data;
  }

  async getConversation(id: string): Promise<MessageParam[]> {
    const { data, error } = await this.client
      .from("messages") // RLS will return only matching conversations with user id
      .select("role, content")
      .eq("conversation_id", id);

    if (error) throw error;
    return data.map((row) => ({
      role: row.role as MessageParam["role"],
      content: row.content as MessageParam["content"],
    }));
  }

  async pushMessage(
    id: string, //conversationID
    role: "user" | "assistant",
    message: MessageParam["content"],
  ) {
    const { error } = await this.client.from("messages").insert({
      conversation_id: id,
      role: role,
      content: JSON.stringify(message),
    });
  }
}
