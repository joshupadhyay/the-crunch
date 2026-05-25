import type { IDatabase } from "./Database";
import { LocalMapDB } from "./Database";
import { DynamoDBDB } from "./DynamoDBClient";
import { SupabaseDB } from "./SupabaseClient";

export async function createDatabase(): Promise<IDatabase> {
  const store = process.env.CHAT_STORE ?? "local";

  if (store === "dynamodb") {
    return DynamoDBDB.connect();
  }

  if (store === "local") {
    return new LocalMapDB();
  }

  return SupabaseDB.connect();
}
