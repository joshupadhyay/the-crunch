import Anthropic from "@anthropic-ai/sdk";
import { AnthropicInstrumentation } from "@arizeai/openinference-instrumentation-anthropic";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";

let sdk: NodeSDK | undefined;

function startObservability() {
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
}

startObservability();
