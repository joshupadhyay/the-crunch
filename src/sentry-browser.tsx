import * as Sentry from "@sentry/react";
import type { ReactNode } from "react";

type ClientObservabilityConfig = {
  sentry?: {
    dsn?: string;
    environment?: string;
    release?: string;
    tracesSampleRate?: number;
    replaysSessionSampleRate?: number;
    replaysOnErrorSampleRate?: number;
  };
};

let browserSentryEnabled = false;

export async function loadClientObservabilityConfig(): Promise<ClientObservabilityConfig> {
  try {
    const response = await fetch("/api/client-config", {
      credentials: "same-origin",
    });

    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
  }
}

export function initBrowserSentry(config: ClientObservabilityConfig) {
  const sentry = config.sentry;
  if (!sentry?.dsn || browserSentryEnabled) return;

  const integrations = [];
  if ((sentry.tracesSampleRate ?? 0) > 0) {
    integrations.push(Sentry.browserTracingIntegration());
  }

  if (
    (sentry.replaysSessionSampleRate ?? 0) > 0 ||
    (sentry.replaysOnErrorSampleRate ?? 0) > 0
  ) {
    integrations.push(Sentry.replayIntegration());
  }

  Sentry.init({
    dsn: sentry.dsn,
    environment: sentry.environment,
    release: sentry.release,
    integrations,
    sendDefaultPii: false,
    tracesSampleRate: sentry.tracesSampleRate ?? 0,
    replaysSessionSampleRate: sentry.replaysSessionSampleRate ?? 0,
    replaysOnErrorSampleRate: sentry.replaysOnErrorSampleRate ?? 0,
  });

  browserSentryEnabled = true;
}

export function BrowserErrorBoundary({ children }: { children: ReactNode }) {
  if (!browserSentryEnabled) return <>{children}</>;

  return (
    <Sentry.ErrorBoundary
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6 text-stone-900">
          <section className="max-w-md rounded-md border border-stone-200 bg-white p-5 shadow-sm">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-stone-600">
              Refresh the page and try again.
            </p>
          </section>
        </main>
      }
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
