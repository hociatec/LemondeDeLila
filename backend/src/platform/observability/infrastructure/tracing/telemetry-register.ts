import { startTelemetry, stopTelemetry } from './telemetry';

startTelemetry();

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void stopTelemetry();
  });
}
