/** Native clients may omit Origin; their JWT/ticket authentication is separate. */
export function isAllowedWsOrigin(
  origin: unknown,
  configuredOrigins: string,
  production: boolean,
): boolean {
  if (origin === undefined) return true;
  if (typeof origin !== 'string' || origin.length > 512 || !origin || origin === 'null') return false;
  try {
    const parsed = new URL(origin);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin
    )
      return false;
  } catch {
    return false;
  }
  const allowed = (typeof configuredOrigins === 'string' ? configuredOrigins : '')
    .slice(0, 16_384)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return allowed.length > 512
    ? false
    : allowed.length > 0
      ? allowed.includes(origin)
      : !production;
}
