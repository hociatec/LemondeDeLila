export function parseVersion(value: string): number | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;

  const parts = raw
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 1 || parts.length > 4) return null;

  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    nums.push(Number(p));
  }
  while (nums.length < 4) nums.push(0);

  if (nums[0] > 999 || nums.slice(1).some((part) => part > 9999)) {
    return null;
  }

  // Base 10,000 prevents component collisions and remains a safe integer for
  // the validated ranges above.
  return (
    nums[0] * 1_000_000_000_000 +
    nums[1] * 100_000_000 +
    nums[2] * 10_000 +
    nums[3]
  );
}

export function isVersionGreater(a: string, b: string): boolean | null {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (pa == null || pb == null) return null;
  return pa > pb;
}

export function isVersionLower(a: string, b: string): boolean | null {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (pa == null || pb == null) return null;
  return pa < pb;
}
