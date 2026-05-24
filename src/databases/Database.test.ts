import { describe, expect, test } from "bun:test";
import { LocalMapDB } from "./Database";

describe("LocalMapDB user scoping", () => {
  test("lists only the authenticated user's conversations", async () => {
    const db = new LocalMapDB();

    const aliceConversation = await db.createConversation("alice");
    await db.createConversation("bob");

    expect(await db.getAllConversations("alice")).toEqual([
      aliceConversation,
    ]);
  });

  test("prevents reading another user's conversation", async () => {
    const db = new LocalMapDB();
    const aliceConversation = await db.createConversation("alice");

    await expect(
      db.getConversation(aliceConversation.id, "bob"),
    ).rejects.toThrow("does not exist");
  });

  test("prevents writing to another user's conversation", async () => {
    const db = new LocalMapDB();
    const aliceConversation = await db.createConversation("alice");

    await expect(
      db.pushMessage(aliceConversation.id, "bob", "user", "hello"),
    ).rejects.toThrow("does not exist");

    expect(await db.getConversation(aliceConversation.id, "alice")).toEqual(
      [],
    );
  });

  test("stores and returns messages for the owner", async () => {
    const db = new LocalMapDB();
    const conversation = await db.createConversation("alice");

    await db.pushMessage(conversation.id, "alice", "user", "hello");
    await db.pushMessage(conversation.id, "alice", "assistant", "hi");

    expect(await db.getConversation(conversation.id, "alice")).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ]);
  });
});
