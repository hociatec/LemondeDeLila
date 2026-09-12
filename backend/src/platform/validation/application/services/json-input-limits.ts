const MAX_DEPTH = 32;
const MAX_NODES = 10_000;
const MAX_STRING_LENGTH = 65_536;
const MAX_OBJECT_KEYS = 512;
const MAX_ARRAY_ITEMS = 10_000;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/** Check untrusted JSON before recursive normalization or DTO transformation. */
export function isBoundedJsonInput(
  value: unknown,
  options: { allowUndefinedProperties?: boolean } = {},
): boolean {
  const pending: Array<{
    value: unknown;
    depth: number;
    exit?: object;
    optional?: boolean;
  }> = [{ value, depth: 0 }];
  const seen = new Set<object>();
  let nodes = 0;
  let pendingValues = 1;
  while (pending.length > 0) {
    const item = pending.pop();
    if (!item) break;
    if (item.exit) {
      seen.delete(item.exit);
      continue;
    }
    pendingValues--;
    if (++nodes > MAX_NODES || item.depth > MAX_DEPTH) return false;
    const current = item.value;
    if (current === undefined && item.optional) continue;
    if (current === null || typeof current === 'boolean') continue;
    if (typeof current === 'string') {
      if (current.length > MAX_STRING_LENGTH) return false;
      continue;
    }
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) return false;
      continue;
    }
    if (typeof current !== 'object' || seen.has(current)) return false;
    seen.add(current);
    const array = Array.isArray(current);
    if (array && current.length >= MAX_ARRAY_ITEMS) return false;
    const prototype: unknown = Object.getPrototypeOf(current);
    if (
      array
        ? prototype !== Array.prototype
        : prototype !== Object.prototype && prototype !== null
    )
      return false;
    const keys = Reflect.ownKeys(current);
    if (array && keys.length !== current.length + 1) return false;
    const entries = keys.filter((key) => !(array && key === 'length'));
    if (!array && entries.length > MAX_OBJECT_KEYS) return false;
    if (nodes + pendingValues + entries.length > MAX_NODES) return false;
    pending.push({ value: null, depth: 0, exit: current });
    for (const key of entries) {
      if (
        typeof key !== 'string' ||
        key.length > 512 ||
        FORBIDDEN_KEYS.has(key)
      )
        return false;
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor?.enumerable || descriptor.get || descriptor.set)
        return false;
      if (
        array &&
        (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= current.length)
      )
        return false;
      pending.push({
        value: descriptor.value,
        depth: item.depth + 1,
        optional: !array && options.allowUndefinedProperties === true,
      });
      pendingValues++;
    }
  }
  return true;
}
