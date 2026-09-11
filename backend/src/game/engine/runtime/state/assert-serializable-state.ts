import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';

/** Reject values that cannot survive JSON persistence. Optional fields may be undefined. */
export function assertSerializableState(
  value: unknown,
  path = 'state',
  seen = new WeakSet<object>(),
  depth = 0,
): void {
  const fail = (reason: string): never => {
    throw new GameStateViolationError(`Etat non serialisable: ${path}`, {
      path,
      reason,
    });
  };
  if (depth > 128) fail('maximum-depth');
  if (value == null || typeof value === 'string' || typeof value === 'boolean')
    return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('non-finite-number');
    return;
  }
  if (typeof value !== 'object') return fail('unsupported-type');
  // The room boundary historically supplies this timestamp as Date or ISO text.
  if (path === 'state.metadata.roomStartedAt' && value instanceof Date) {
    if (!Number.isFinite(value.getTime())) fail('invalid-date');
    return;
  }
  if (seen.has(value)) fail('cycle');
  const prototype: object | null = Reflect.getPrototypeOf(value);
  if (
    !Array.isArray(value) &&
    prototype !== null &&
    prototype !== Object.prototype &&
    !(
      Object.getPrototypeOf(prototype) === null &&
      prototype.constructor?.name === 'Object'
    )
  )
    fail('unsupported-prototype');
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) return fail('missing-property-descriptor');
    if (typeof key === 'symbol') fail('symbol-key');
    if (descriptor.get || descriptor.set) fail('accessor');
    if (!descriptor.enumerable) continue;
    assertSerializableState(
      descriptor.value,
      `${path}.${String(key)}`,
      seen,
      depth + 1,
    );
  }
  seen.delete(value);
}
