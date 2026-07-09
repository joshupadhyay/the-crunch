export type UserFeedbackInput = {
  traceId: string;
  score: 0 | 1;
  comment?: string;
  conversationId?: string;
  userId?: string;
};

export type UserFeedbackResult =
  | { ok: true; scoreId: string }
  | { ok: false; reason: "disabled" | "invalid" | "upstream"; detail?: string };

function langfuseHost() {
  return (
    process.env.LANGFUSE_BASE_URL ??
    process.env.LANGFUSE_HOST ??
    "https://cloud.langfuse.com"
  ).replace(/\/$/, "");
}

function langfuseAuthHeader() {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) return undefined;
  return `Basic ${btoa(`${publicKey}:${secretKey}`)}`;
}

export function isLangfuseFeedbackEnabled() {
  return Boolean(langfuseAuthHeader());
}

/**
 * Attach end-user feedback to a Langfuse trace (LangSmith createFeedback equivalent).
 * Scores appear on the trace in Langfuse under the "user-feedback" key.
 */
export async function postUserFeedback(
  input: UserFeedbackInput,
): Promise<UserFeedbackResult> {
  const auth = langfuseAuthHeader();
  if (!auth) {
    return { ok: false, reason: "disabled" };
  }

  const traceId = input.traceId.trim();
  if (!/^[0-9a-f]{32}$/i.test(traceId)) {
    return { ok: false, reason: "invalid", detail: "Invalid traceId" };
  }

  if (input.score !== 0 && input.score !== 1) {
    return { ok: false, reason: "invalid", detail: "Score must be 0 or 1" };
  }

  const comment = input.comment?.trim();
  const body: Record<string, unknown> = {
    id: `user-feedback-${traceId}`,
    traceId,
    name: "user-feedback",
    value: input.score,
    dataType: "BOOLEAN",
  };

  if (comment) {
    body.comment = comment.slice(0, 1000);
  }

  if (input.conversationId) {
    body.metadata = {
      conversationId: input.conversationId,
      ...(input.userId ? { userId: input.userId } : {}),
    };
  }

  const resp = await fetch(`${langfuseHost()}/api/public/scores`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => undefined);
    return {
      ok: false,
      reason: "upstream",
      detail: detail?.slice(0, 200) ?? `HTTP ${resp.status}`,
    };
  }

  const data = (await resp.json().catch(() => ({}))) as { id?: string };
  return { ok: true, scoreId: data.id ?? `user-feedback-${traceId}` };
}
