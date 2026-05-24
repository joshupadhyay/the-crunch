import Anthropic from "@anthropic-ai/sdk";
import { AnthropicInstrumentation } from "@arizeai/openinference-instrumentation-anthropic";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import * as Sentry from "@sentry/bun";
import { NodeSDK } from "@opentelemetry/sdk-node";

let sdk: NodeSDK | undefined;
let sentryStarted = false;

function parseSampleRate(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 0), 1);
}

function startSentry() {
  if (sentryStarted) return;

  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: parseSampleRate("SENTRY_TRACES_SAMPLE_RATE", 0),
  });

  sentryStarted = true;
}

function startObservability() {
  startSentry();

  if (sdk) return;

  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return;
  }

  const instrumentation = new AnthropicInstrumentation();
  instrumentation.manuallyInstrument(Anthropic);

  sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor()],
    instrumentations: [instrumentation],
  });

  sdk.start();
}

export async function shutdownObservability() {
  await sdk?.shutdown();
  await Sentry.close(2000);
}

export function captureServerException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  if (!sentryStarted) return;

  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
    }

    Sentry.captureException(error);
  });
}

startObservability();
