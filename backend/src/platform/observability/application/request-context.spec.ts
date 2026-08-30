import {
  currentCorrelationId,
  normalizeCorrelationId,
  runWithCorrelationId,
} from './request-context';

describe('request correlation context', () => {
  it('propagates a valid id across asynchronous work', async () => {
    await runWithCorrelationId('request-42', async () => {
      await Promise.resolve();
      expect(currentCorrelationId()).toBe('request-42');
    });
    expect(currentCorrelationId()).toBeUndefined();
  });

  it('rejects unsafe or oversized incoming identifiers', () => {
    expect(normalizeCorrelationId('ok:42')).toBe('ok:42');
    expect(normalizeCorrelationId('line\nbreak')).toMatch(/^[0-9a-f-]{36}$/);
    expect(normalizeCorrelationId('x'.repeat(129))).toMatch(/^[0-9a-f-]{36}$/);
  });
});
