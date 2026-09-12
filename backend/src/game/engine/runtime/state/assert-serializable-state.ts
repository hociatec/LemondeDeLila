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
  if (
    path === 'state.metadata.roomStartedAt' &&
    isSupportedNativePrototype(Reflect.getPrototypeOf(value), 'date')
  ) {
    if (Reflect.ownKeys(value).length !== 0) fail('date-property');
    try {
      if (!Number.isFinite(Date.prototype.getTime.call(value)))
        fail('invalid-date');
    } catch {
      fail('invalid-date');
    }
    return;
  }
  if (seen.has(value)) fail('cycle');
  const prototype: object | null = Reflect.getPrototypeOf(value);
  const array = Array.isArray(value);
  if (
    !(prototype === null && !array) &&
    !isSupportedNativePrototype(prototype, array)
  )
    fail('unsupported-prototype');
  seen.add(value);
  if (array) {
    if (Reflect.ownKeys(value).length !== value.length + 1)
      fail('array-properties');
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index)) fail('sparse-array');
    }
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) return fail('missing-property-descriptor');
    if (typeof key === 'symbol') fail('symbol-key');
    if (descriptor.get || descriptor.set) fail('accessor');
    if (array && key === 'length') continue;
    if (!descriptor.enumerable) fail('non-enumerable-property');
    if (array) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || String(index) !== key)
        fail('array-property');
      if (descriptor.value === undefined) fail('undefined-array-entry');
    }
    assertSerializableState(
      descriptor.value,
      `${path}.${String(key)}`,
      seen,
      depth + 1,
    );
  }
  seen.delete(value);
}

/** Accept native containers from other realms without trusting constructor names. */
function isSupportedNativePrototype(
  prototype: object | null,
  kind: boolean | 'date',
): boolean {
  if (!prototype) return false;
  const constructor: unknown = Object.getOwnPropertyDescriptor(
    prototype,
    'constructor',
  )?.value;
  return (
    typeof constructor === 'function' &&
    Object.getOwnPropertyDescriptor(constructor, 'prototype')?.value ===
      prototype &&
    Function.prototype.toString.call(constructor) ===
      Function.prototype.toString.call(
        kind === 'date' ? Date : kind ? Array : Object,
      )
  );
}
