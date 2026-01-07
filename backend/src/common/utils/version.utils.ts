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

  // Pack into a monotonic integer: major.minor.build.rev (up to 4 digits each).
  return (
    nums[0] * 1_000_000_000 + nums[1] * 1_000_000 + nums[2] * 1_000 + nums[3]
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
