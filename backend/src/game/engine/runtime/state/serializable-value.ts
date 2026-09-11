export function sameSerializableValue(
  left: unknown,
  right: unknown,
  depth = 0,
  seen = new WeakMap<object, object>(),
): boolean {
  if (depth > 32) return false;
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) =>
        sameSerializableValue(value, right[index], depth + 1, seen),
      )
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  if (seen.get(left) === right) return true;
  seen.set(left, right);
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        sameSerializableValue(left[key], right[key], depth + 1, seen),
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object';
}
