export const TRIAL_ID_STORAGE_KEY = "the-crunch-trial-id";
export const TRIAL_MESSAGE_LIMIT = 15;

export function getOrCreateTrialId() {
  const existing = localStorage.getItem(TRIAL_ID_STORAGE_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(TRIAL_ID_STORAGE_KEY, id);
  return id;
}

export function getTrialHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Trial-Id": getOrCreateTrialId(),
  };
}
