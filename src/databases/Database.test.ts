import { describe, test, expect, beforeEach } from "bun:test";
import type { IDatabase, Conversation } from "./Database";
import { LocalMapDB } from "./Database";
import { SupabaseDB } from "./SupabaseClient";
import { createMockSupabaseClient } from "./mockSupabaseClient";

/**
 * Implementation-agnostic test suite for IDatabase.
 *
 * Every IDatabase implementation must pass this same suite, guaranteeing
 * behavioural parity regardless of the backing store.
 */
export function testIDatabase(
  name: string,
  factory: () => IDatabase | Promise<IDatabase>,
) {
  describe(`IDatabase: ${name}`, () => {
    let db: IDatabase;

    beforeEach(async () => {
      db = await factory();
    });

    // ── createConversation ──────────────────────────────────────

    test("createConversation returns a Conversation with non-empty id and createdAt", async () => {
      const conv = await db.createConversation();
      expect(typeof conv.id).toBe("string");
      expect(conv.id.length).toBeGreaterThan(0);
      expect(typeof conv.createdAt).toBe("string");
      expect(conv.createdAt.length).toBeGreaterThan(0);
    });

    test("createConversation returns unique IDs", async () => {
      const convos = await Promise.all(
        Array.from({ length: 20 }, () => db.createConversation()),
      );
      const ids = new Set(convos.map((c) => c.id));
      expect(ids.size).toBe(20);
    });

    // ── getConversation ─────────────────────────────────────────

    test("getConversation returns an empty array for a new conversation", async () => {
      const conv = await db.createConversation();
      const messages = await db.getConversation(conv.id);
      expect(messages).toEqual([]);
    });

    test("getConversation throws for a non-existent ID", async () => {
      expect(db.getConversation("does-not-exist")).rejects.toThrow();
    });

    // ── getAllConversations ──────────────────────────────────────

    test("getAllConversations returns empty array when no conversations exist", async () => {
      const all = await db.getAllConversations();
      expect(all).toEqual([]);
    });

    test("getAllConversations returns all created conversations", async () => {
      const c1 = await db.createConversation();
      const c2 = await db.createConversation();
      const c3 = await db.createConversation();

      const all = await db.getAllConversations();
      const ids = all.map((c: Conversation) => c.id);
      expect(ids).toContain(c1.id);
      expect(ids).toContain(c2.id);
      expect(ids).toContain(c3.id);
      expect(all.length).toBe(3);
    });

    test("getAllConversations returns Conversation objects with createdAt", async () => {
      await db.createConversation();
      const all = await db.getAllConversations();
      expect(all[0]).toHaveProperty("id");
      expect(all[0]).toHaveProperty("createdAt");
    });

    // ── pushMessage ─────────────────────────────────────────────

    test("pushMessage adds a user message and returns updated array", async () => {
      const conv = await db.createConversation();
      const result = await db.pushMessage(conv.id, "user", "hello");

      expect(result).toEqual([{ role: "user", content: "hello" }]);
    });

    test("pushMessage adds an assistant message", async () => {
      const conv = await db.createConversation();
      await db.pushMessage(conv.id, "user", "hi");
      const result = await db.pushMessage(conv.id, "assistant", "hello back");

      expect(result).toEqual([
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello back" },
      ]);
    });

    test("pushMessage preserves message order across many messages", async () => {
      const conv = await db.createConversation();

      for (let i = 0; i < 10; i++) {
        const role = i % 2 === 0 ? "user" : "assistant";
        await db.pushMessage(conv.id, role, `msg-${i}`);
      }

      const messages = await db.getConversation(conv.id);
      expect(messages.length).toBe(10);
      messages.forEach((msg, i) => {
        expect(msg.content).toBe(`msg-${i}`);
        expect(msg.role).toBe(i % 2 === 0 ? "user" : "assistant");
      });
    });

    test("pushMessage throws for a non-existent conversation", async () => {
      expect(
        db.pushMessage("does-not-exist", "user", "hello"),
      ).rejects.toThrow();
    });

    // ── conversation isolation ──────────────────────────────────

    test("messages in one conversation don't leak into another", async () => {
      const c1 = await db.createConversation();
      const c2 = await db.createConversation();

      await db.pushMessage(c1.id, "user", "for conversation 1");
      await db.pushMessage(c2.id, "user", "for conversation 2");

      expect(await db.getConversation(c1.id)).toEqual([
        { role: "user", content: "for conversation 1" },
      ]);
      expect(await db.getConversation(c2.id)).toEqual([
        { role: "user", content: "for conversation 2" },
      ]);
    });

    // ── deleteConversation (optional) ───────────────────────────

    test("deleteConversation removes the conversation if implemented", async () => {
      if (!db.deleteConversation) return;

      const conv = await db.createConversation();
      await db.pushMessage(conv.id, "user", "soon to be deleted");
      await db.deleteConversation(conv.id);

      expect(db.getConversation(conv.id)).rejects.toThrow();
      const all = await db.getAllConversations();
      expect(all.map((c: Conversation) => c.id)).not.toContain(conv.id);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// Run the suite against every IDatabase implementation
// ═══════════════════════════════════════════════════════════════

testIDatabase("LocalMapDB", () => new LocalMapDB());

testIDatabase("SupabaseDB (mock client)", () => {
  const mockClient = createMockSupabaseClient();
  // SupabaseDB has a private constructor, but the client field is public.
  // We construct via Object.create to bypass the private constructor,
  // then assign the mock client.
  const instance = Object.create(SupabaseDB.prototype) as SupabaseDB;
  instance.client = mockClient;
  return instance;
});
