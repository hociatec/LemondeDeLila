const VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/;

export type UpdateVersion = readonly [number, number, number, number];

export function parseUpdateVersion(value: string): UpdateVersion | null {
  const match = VERSION_PATTERN.exec((value || '').trim());
  if (!match) return null;
  const parts: UpdateVersion = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4] ?? 0),
  ];
  if (parts.some((part) => !Number.isSafeInteger(part) || part > 999_999)) {
    return null;
  }
  return parts;
}

export function compareUpdateVersions(
  left: string,
  right: string,
): number | null {
  const a = parseUpdateVersion(left);
  const b = parseUpdateVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}
