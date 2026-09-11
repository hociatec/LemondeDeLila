const immutableCollections = new WeakSet<object>();

/** Freeze records in place; collections become isolated read-only facades. */
export function deepFreeze<TValue>(value: TValue): TValue {
  return freeze(value, new WeakMap()) as TValue;
}

function freeze(value: unknown, visited: WeakMap<object, object>): unknown {
  if (value == null || typeof value !== 'object') return value;
  if (immutableCollections.has(value)) return value;
  const existing = visited.get(value);
  if (existing) return existing;
  if (value instanceof Map) return freezeMap(value, visited);
  if (value instanceof Set) return freezeSet(value, visited);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const needsCopy =
    !Object.isExtensible(value) ||
    Object.values(descriptors).some(
      (descriptor) => 'value' in descriptor && !descriptor.writable,
    );
  const result: object = needsCopy
    ? Array.isArray(value)
      ? []
      : (Object.create(Object.getPrototypeOf(value) as object | null) as object)
    : value;
  visited.set(value, result);
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = Reflect.get(descriptors, key) as PropertyDescriptor;
    if ('value' in descriptor)
      descriptor.value = freeze(descriptor.value, visited);
  }
  if (
    needsCopy &&
    Reflect.ownKeys(descriptors).every((key) => {
      const before = Object.getOwnPropertyDescriptor(value, key);
      const after = Reflect.get(descriptors, key) as PropertyDescriptor;
      return !('value' in after) || before?.value === after.value;
    })
  ) {
    visited.set(value, value);
    return Object.freeze(value);
  }
  Object.defineProperties(result, descriptors);
  return Object.freeze(result);
}

function freezeMap(
  value: Map<unknown, unknown>,
  visited: WeakMap<object, object>,
): object {
  const entries = new Map<unknown, unknown>();
  const view = new Proxy(Object.create(Map.prototype), {}) as Map<
    unknown,
    unknown
  >;
  visited.set(value, view);
  for (const [key, entry] of value)
    entries.set(freeze(key, visited), freeze(entry, visited));
  Object.defineProperties(view, {
    size: { get: () => entries.size },
    get: { value: (key: unknown) => entries.get(key) },
    has: { value: (key: unknown) => entries.has(key) },
    keys: { value: () => entries.keys() },
    values: { value: () => entries.values() },
    entries: { value: () => entries.entries() },
    [Symbol.iterator]: { value: () => entries.entries() },
    forEach: {
      value: (
        callback: (entry: unknown, key: unknown, map: typeof view) => void,
        thisArg?: unknown,
      ) =>
        entries.forEach((entry, key) =>
          callback.call(thisArg, entry, key, view),
        ),
    },
    set: { value: rejectMutation },
    delete: { value: rejectMutation },
    clear: { value: rejectMutation },
  });
  immutableCollections.add(view);
  return Object.freeze(view);
}

function freezeSet(
  value: Set<unknown>,
  visited: WeakMap<object, object>,
): object {
  const entries = new Set<unknown>();
  const view = new Proxy(Object.create(Set.prototype), {}) as Set<unknown>;
  visited.set(value, view);
  for (const entry of value) entries.add(freeze(entry, visited));
  Object.defineProperties(view, {
    size: { get: () => entries.size },
    has: { value: (entry: unknown) => entries.has(entry) },
    keys: { value: () => entries.keys() },
    values: { value: () => entries.values() },
    entries: { value: () => entries.entries() },
    [Symbol.iterator]: { value: () => entries.values() },
    forEach: {
      value: (
        callback: (entry: unknown, key: unknown, set: typeof view) => void,
        thisArg?: unknown,
      ) =>
        entries.forEach((entry) => callback.call(thisArg, entry, entry, view)),
    },
    add: { value: rejectMutation },
    delete: { value: rejectMutation },
    clear: { value: rejectMutation },
  });
  immutableCollections.add(view);
  return Object.freeze(view);
}

function rejectMutation(): never {
  throw new TypeError('Le contenu statique du jeu est immuable');
}

/** structuredClone cannot preserve read-only collection facades. */
export function cloneStaticContent<T>(value: T): T {
  return clone(value, new WeakMap()) as T;
}

function clone(value: unknown, visited: WeakMap<object, object>): unknown {
  if (value == null || typeof value !== 'object') return value;
  const existing = visited.get(value);
  if (existing) return existing;
  if (value instanceof Map) {
    const result = new Map<unknown, unknown>();
    visited.set(value, result);
    for (const [key, entry] of value)
      result.set(clone(key, visited), clone(entry, visited));
    return result;
  }
  if (value instanceof Set) {
    const result = new Set<unknown>();
    visited.set(value, result);
    for (const entry of value) result.add(clone(entry, visited));
    return result;
  }
  const result: object = Array.isArray(value) ? new Array(value.length) : {};
  visited.set(value, result);
  for (const [key, entry] of Object.entries(value)) {
    Object.defineProperty(result, key, {
      value: clone(entry, visited),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return result;
}
