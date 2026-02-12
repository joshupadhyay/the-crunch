/**
 * In-memory mock of a SupabaseClient for testing SupabaseDB.
 *
 * Implements only the chained query-builder patterns that SupabaseDB actually
 * uses:
 *   - from("conversations").insert({}).select("...").single()
 *   - from("conversations").select("...").order(...)
 *   - from("messages").select("...").eq("conversation_id", id).order(...)
 *   - from("messages").insert({})
 *
 * Backed by two simple arrays that behave like Postgres tables with
 * auto-generated id / created_at columns.
 */

import { randomUUIDv7 } from "bun";

type ConversationRow = {
  id: string;
  user_id: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string | object;
  created_at: string;
};

/**
 * Creates a mock object that satisfies the SupabaseClient surface area
 * used by SupabaseDB. Pass the return value directly to SupabaseDB as
 * its `client` property.
 */
export function createMockSupabaseClient(): any {
  const conversations: ConversationRow[] = [];
  const messages: MessageRow[] = [];

  // Monotonically increasing counter so created_at ordering is deterministic
  let tick = 0;
  const nextTimestamp = () => new Date(Date.now() + tick++).toISOString();

  function from(table: string) {
    if (table === "conversations") {
      return conversationBuilder();
    }
    if (table === "messages") {
      return messageBuilder();
    }
    throw new Error(`Mock: unknown table "${table}"`);
  }

  // ── conversations builder ───────────────────────────────────
  function conversationBuilder() {
    let pendingInsert: Partial<ConversationRow> | null = null;
    let selectColumns: string[] | null = null;
    let filters: Array<{ col: string; value: string }> = [];
    let orderColumn: string | null = null;
    let orderAscending = true;

    const builder: any = {
      insert(row: Partial<ConversationRow>) {
        pendingInsert = row;
        return builder;
      },

      select(cols?: string) {
        selectColumns = cols ? cols.split(",").map((c: string) => c.trim()) : null;
        return builder;
      },

      eq(col: string, value: string) {
        filters.push({ col, value });
        return builder;
      },

      order(col: string, opts?: { ascending?: boolean }) {
        orderColumn = col;
        orderAscending = opts?.ascending ?? true;
        // Return a thenable so `await` resolves the query
        return {
          then: (resolve: any, reject: any) => {
            try {
              let rows = conversations.filter((r) =>
                filters.every((f) => (r as any)[f.col] === f.value),
              );
              if (orderColumn === "created_at") {
                rows.sort((a, b) =>
                  orderAscending
                    ? a.created_at.localeCompare(b.created_at)
                    : b.created_at.localeCompare(a.created_at),
                );
              }
              const data = selectColumns
                ? rows.map((r) => pick(r, selectColumns!))
                : rows;
              resolve({ data, error: null });
            } catch (e) {
              reject(e);
            }
          },
        };
      },

      single() {
        return {
          then: (resolve: any, reject: any) => {
            try {
              // INSERT path: insert + select + single
              if (pendingInsert) {
                const row: ConversationRow = {
                  id: randomUUIDv7().toString(),
                  user_id: pendingInsert.user_id ?? "",
                  created_at: nextTimestamp(),
                };
                conversations.push(row);
                const data = selectColumns ? pick(row, selectColumns!) : row;
                resolve({ data, error: null });
                return;
              }

              // SELECT path: select + eq + single (existence check)
              const matches = conversations.filter((r) =>
                filters.every((f) => (r as any)[f.col] === f.value),
              );
              if (matches.length === 0) {
                resolve({
                  data: null,
                  error: { message: "Row not found", code: "PGRST116" },
                });
              } else {
                const row = matches[0]!;
                const data = selectColumns ? pick(row, selectColumns!) : row;
                resolve({ data, error: null });
              }
            } catch (e) {
              reject(e);
            }
          },
        };
      },
    };
    return builder;
  }

  // ── messages builder ────────────────────────────────────────
  function messageBuilder() {
    let pendingInsert: Partial<MessageRow> | null = null;
    let selectColumns: string[] | null = null;
    let filters: Array<{ col: string; value: string }> = [];
    let orderColumn: string | null = null;
    let orderAscending = true;

    const builder: any = {
      insert(row: Partial<MessageRow>) {
        pendingInsert = row;
        // Return a thenable — SupabaseDB awaits the insert directly
        return {
          then: (resolve: any, reject: any) => {
            try {
              // Verify the conversation exists
              const convExists = conversations.some(
                (c) => c.id === row.conversation_id,
              );
              if (!convExists) {
                resolve({
                  data: null,
                  error: {
                    message: `Conversation ${row.conversation_id} does not exist.`,
                  },
                });
                return;
              }

              const newRow: MessageRow = {
                id: randomUUIDv7().toString(),
                conversation_id: row.conversation_id!,
                role: row.role!,
                content: row.content!,
                created_at: nextTimestamp(),
              };
              messages.push(newRow);
              resolve({ data: newRow, error: null });
            } catch (e) {
              reject(e);
            }
          },
        };
      },

      select(cols?: string) {
        selectColumns = cols ? cols.split(",").map((c: string) => c.trim()) : null;
        return builder;
      },

      eq(col: string, value: string) {
        filters.push({ col, value });
        return builder;
      },

      order(col: string, opts?: { ascending?: boolean }) {
        orderColumn = col;
        orderAscending = opts?.ascending ?? true;
        // Terminal — return thenable
        return {
          then: (resolve: any, reject: any) => {
            try {
              let rows = messages.filter((m) =>
                filters.every(
                  (f) => (m as any)[f.col] === f.value,
                ),
              );

              if (orderColumn === "created_at") {
                rows.sort((a, b) =>
                  orderAscending
                    ? a.created_at.localeCompare(b.created_at)
                    : b.created_at.localeCompare(a.created_at),
                );
              }

              const data = selectColumns
                ? rows.map((r) => pick(r, selectColumns!))
                : rows;
              resolve({ data, error: null });
            } catch (e) {
              reject(e);
            }
          },
        };
      },
    };
    return builder;
  }

  return { from };
}

/** Pick only the given keys from an object. */
function pick<T extends Record<string, any>>(obj: T, keys: string[]): Partial<T> {
  const result: any = {};
  for (const k of keys) {
    if (k in obj) result[k] = obj[k];
  }
  return result;
}
