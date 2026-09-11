const MAX_DEPTH = 32;
const MAX_NODES = 10_000;
const MAX_STRING_LENGTH = 65_536;
const MAX_OBJECT_KEYS = 512;
const MAX_ARRAY_ITEMS = 10_000;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/** Check untrusted JSON before recursive normalization or DTO transformation. */
export function isBoundedJsonInput(value: unknown): boolean {
  const pending = [{ value, depth: 0 }];
  const seen = new Set<object>();
  let nodes = 0;
  while (pending.length > 0) {
    const item = pending.pop();
    if (!item) break;
    if (++nodes > MAX_NODES || item.depth > MAX_DEPTH) return false;
    const current = item.value;
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
    if (Array.isArray(current) && current.length >= MAX_ARRAY_ITEMS)
      return false;
    if (!Array.isArray(current)) {
      const prototype: unknown = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) return false;
    }
    const entries = Object.entries(current);
    if (!Array.isArray(current) && entries.length > MAX_OBJECT_KEYS)
      return false;
    if (entries.some(([key]) => key.length > 512)) return false;
    if (nodes + pending.length + entries.length > MAX_NODES) return false;
    for (const [key, child] of entries) {
      if (FORBIDDEN_KEYS.has(key)) return false;
      pending.push({ value: child, depth: item.depth + 1 });
    }
  }
  return true;
}
