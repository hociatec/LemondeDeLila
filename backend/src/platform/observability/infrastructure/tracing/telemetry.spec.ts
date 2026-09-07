import { inSpan, startTelemetry, stopTelemetry } from './telemetry';

describe('telemetry', () => {
  afterEach(() => stopTelemetry());

  it('stays disabled in tests and when explicitly disabled', () => {
    expect(startTelemetry({ NODE_ENV: 'test' })).toBeNull();
    expect(startTelemetry({ OTEL_SDK_DISABLED: 'true' })).toBeNull();
  });

  it('executes successful and failing operations inside a span', async () => {
    await expect(inSpan('test.success', {}, async () => 42)).resolves.toBe(42);
    await expect(
      inSpan('test.failure', {}, async () => {
        throw new Error('failure');
      }),
    ).rejects.toThrow('failure');
  });
});
