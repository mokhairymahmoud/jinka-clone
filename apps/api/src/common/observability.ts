import * as Sentry from "@sentry/node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";

let sdk: NodeSDK | null = null;

export async function bootstrapObservability() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 1
    });
  }

  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      })
    });

    await sdk.start();
  }
}

export async function shutdownObservability() {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }

  await Sentry.close(2000);
}
