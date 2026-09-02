import { SpanStatusCode, trace, type Attributes } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

const SERVICE_NAME = 'le-monde-de-lila-backend';
let sdk: NodeSDK | null = null;

export function startTelemetry(
  environment: NodeJS.ProcessEnv = process.env,
): NodeSDK | null {
  if (sdk || telemetryDisabled(environment)) return sdk;
  sdk = new NodeSDK({
    serviceName: environment.OTEL_SERVICE_NAME?.trim() || SERVICE_NAME,
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  sdk.start();
  return sdk;
}

export async function stopTelemetry(): Promise<void> {
  const activeSdk = sdk;
  sdk = null;
  await activeSdk?.shutdown();
}

export async function inSpan<T>(
  name: string,
  attributes: Attributes,
  operation: () => Promise<T>,
): Promise<T> {
  return trace
    .getTracer(SERVICE_NAME)
    .startActiveSpan(name, { attributes }, async (span) => {
      try {
        return await operation();
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        if (error instanceof Error) span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
}

function telemetryDisabled(environment: NodeJS.ProcessEnv): boolean {
  return (
    environment.OTEL_SDK_DISABLED?.trim().toLowerCase() === 'true' ||
    environment.NODE_ENV === 'test'
  );
}
