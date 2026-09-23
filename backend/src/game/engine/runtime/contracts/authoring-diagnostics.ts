import { AuthoringError, authoringValueAt } from './authoring-error';

export type AuthoringFailure = (field: string, reason: string) => never;

export function authoringProperty(base: string, key: string): string {
  return /^[\w$-]+$/.test(key)
    ? `${base}${base ? '.' : ''}${key}`
    : `${base}[${JSON.stringify(key)}]`;
}

export function authoringFailure(
  root: string,
  value: unknown,
  label = '',
): AuthoringFailure {
  return (field, reason) => {
    throw new AuthoringError(
      `${root}.${field}`,
      reason,
      authoringValueAt(value, field),
      `${label}${reason}`,
    );
  };
}

/** Report the second occurrence, the value the author needs to change. */
export function assertUniqueAuthorValues<Value>(
  values: readonly Value[],
  field: (index: number) => string,
  fail: AuthoringFailure,
): void {
  const seen = new Set<Value>();
  values.forEach((value, index) => {
    if (seen.has(value)) fail(field(index), 'unique value required');
    seen.add(value);
  });
}

export function assertUniqueAuthorIds(
  entries: readonly { id: string | number }[],
  path: string,
  fail: AuthoringFailure,
): void {
  assertUniqueAuthorValues(
    entries.map((entry) => entry.id),
    (i) => `${path}[${i}].id`,
    fail,
  );
}
