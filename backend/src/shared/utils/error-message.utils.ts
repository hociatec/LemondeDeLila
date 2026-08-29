export function getErrorMessage(
  value: unknown,
  fallback = 'erreur inconnue',
): string {
  if (value instanceof Error) {
    return value.message.trim() || fallback;
  }
  if (typeof value === 'string') {
    return value.trim() || fallback;
  }
  if (isRecord(value) && typeof value.message === 'string') {
    return value.message.trim() || fallback;
  }
  return fallback;
}

export function getErrorDetails(value: unknown): string {
  if (value instanceof Error) {
    return value.stack?.trim() || getErrorMessage(value);
  }
  return getErrorMessage(value);
}

export function getErrorCode(value: unknown): string | null {
  return isRecord(value) && typeof value.code === 'string' ? value.code : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
