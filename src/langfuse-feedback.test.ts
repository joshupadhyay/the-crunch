import { describe, expect, test } from "bun:test";
import { isLangfuseFeedbackEnabled, postUserFeedback } from "./langfuse-feedback";

describe("langfuse-feedback", () => {
  test("is disabled without Langfuse credentials", () => {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;

    expect(isLangfuseFeedbackEnabled()).toBe(false);

    if (publicKey) process.env.LANGFUSE_PUBLIC_KEY = publicKey;
    if (secretKey) process.env.LANGFUSE_SECRET_KEY = secretKey;
  });

  test("rejects invalid trace ids", async () => {
    process.env.LANGFUSE_PUBLIC_KEY = "pk-test";
    process.env.LANGFUSE_SECRET_KEY = "sk-test";

    const result = await postUserFeedback({
      traceId: "not-a-trace-id",
      score: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid");
    }

    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
  });
});
