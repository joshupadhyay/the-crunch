import { describe, test, expect, beforeEach } from "bun:test";
import type { IDatabase } from "./Database";
import { LocalMapDB } from "./Database";

/**
 * Implementation-agnostic test suite for IDatabase.
 * Call this with any IDatabase factory to test a new implementation.
 */
export function testIDatabase(
  name: string,
  factory: () => IDatabase,
) {
  describe(`IDatabase: ${name}`, () => {
    let db: IDatabase;

    beforeEach(() => {
      db = factory();
    });

    // -- createConversation --

    test("createConversation returns a non-empty string ID", () => {
      const id = db.createConversation();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    test("createConversation returns unique IDs", () => {
      const ids = new Set(
        Array.from({ length: 20 }, () => db.createConversation()),
      );
      expect(ids.size).toBe(20);
    });

    // -- getConversation --

    test("getConversation returns an empty array for a new conversation", () => {
      const id = db.createConversation();
      const messages = db.getConversation(id);
      expect(messages).toEqual([]);
    });

    test("getConversation throws for a non-existent ID", () => {
      expect(() => db.getConversation("does-not-exist")).toThrow();
    });

    // -- getAllConversations --

    test("getAllConversations returns empty array when no conversations exist", () => {
      expect(db.getAllConversations()).toEqual([]);
    });

    test("getAllConversations returns all created conversation IDs", () => {
      const id1 = db.createConversation();
      const id2 = db.createConversation();
      const id3 = db.createConversation();

      const all = db.getAllConversations();
      expect(all).toContain(id1);
      expect(all).toContain(id2);
      expect(all).toContain(id3);
      expect(all.length).toBe(3);
    });

    // -- pushMessage --

    test("pushMessage adds a user message and returns updated array", () => {
      const id = db.createConversation();
      const result = db.pushMessage(id, "user", "hello");

      expect(result).toEqual([{ role: "user", content: "hello" }]);
    });

    test("pushMessage adds an assistant message", () => {
      const id = db.createConversation();
      db.pushMessage(id, "user", "hi");
      const result = db.pushMessage(id, "assistant", "hello back");

      expect(result).toEqual([
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello back" },
      ]);
    });

    test("pushMessage preserves message order across many messages", () => {
      const id = db.createConversation();

      for (let i = 0; i < 10; i++) {
        const role = i % 2 === 0 ? "user" : "assistant";
        db.pushMessage(id, role, `msg-${i}`);
      }

      const messages = db.getConversation(id);
      expect(messages.length).toBe(10);
      messages.forEach((msg, i) => {
        expect(msg.content).toBe(`msg-${i}`);
        expect(msg.role).toBe(i % 2 === 0 ? "user" : "assistant");
      });
    });

    test("pushMessage throws for a non-existent conversation", () => {
      expect(() =>
        db.pushMessage("does-not-exist", "user", "hello"),
      ).toThrow();
    });

    test("pushMessage with content block array", () => {
      const id = db.createConversation();
      const content = [{ type: "text" as const, text: "structured content" }];
      const result = db.pushMessage(id, "user", content);

      expect(result).toEqual([{ role: "user", content }]);
    });

    // -- conversations are isolated --

    test("messages in one conversation don't leak into another", () => {
      const id1 = db.createConversation();
      const id2 = db.createConversation();

      db.pushMessage(id1, "user", "for conversation 1");
      db.pushMessage(id2, "user", "for conversation 2");

      expect(db.getConversation(id1)).toEqual([
        { role: "user", content: "for conversation 1" },
      ]);
      expect(db.getConversation(id2)).toEqual([
        { role: "user", content: "for conversation 2" },
      ]);
    });

    // -- deleteConversation (optional) --

    test("deleteConversation removes the conversation if implemented", () => {
      if (!db.deleteConversation) return; // skip if not implemented

      const id = db.createConversation();
      db.pushMessage(id, "user", "soon to be deleted");
      db.deleteConversation(id);

      expect(() => db.getConversation(id)).toThrow();
      expect(db.getAllConversations()).not.toContain(id);
    });
  });
}

// Run the suite against LocalMapDB
testIDatabase("LocalMapDB", () => new LocalMapDB());
