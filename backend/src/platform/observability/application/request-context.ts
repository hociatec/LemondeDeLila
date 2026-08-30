import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

type RequestContext = { correlationId: string };

const storage = new AsyncLocalStorage<RequestContext>();
const VALID_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function normalizeCorrelationId(value: unknown): string {
  const candidate: unknown = Array.isArray(value)
    ? (value as unknown[]).at(0)
    : value;
  return typeof candidate === 'string' && VALID_CORRELATION_ID.test(candidate)
    ? candidate
    : randomUUID();
}

export function runWithCorrelationId<T>(
  correlationId: string,
  operation: () => T,
): T {
  return storage.run({ correlationId }, operation);
}

export function currentCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}
