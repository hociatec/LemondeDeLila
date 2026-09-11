const MAX_ERROR_MESSAGE_LENGTH = 2_000;
const MAX_ERROR_DETAILS_LENGTH = 16_384;
const MAX_ERROR_CODE_LENGTH = 128;

export function getErrorMessage(
  value: unknown,
  fallback = 'erreur inconnue',
): string {
  if (value instanceof Error) {
    return (value.message.trim() || fallback).slice(0, MAX_ERROR_MESSAGE_LENGTH);
  }
  if (typeof value === 'string') {
    return (value.trim() || fallback).slice(0, MAX_ERROR_MESSAGE_LENGTH);
  }
  if (isRecord(value) && typeof value.message === 'string') {
    return (value.message.trim() || fallback).slice(0, MAX_ERROR_MESSAGE_LENGTH);
  }
  return fallback.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

export function getErrorDetails(value: unknown): string {
  if (value instanceof Error) {
    return (value.stack?.trim() || getErrorMessage(value)).slice(
      0,
      MAX_ERROR_DETAILS_LENGTH,
    );
  }
  return getErrorMessage(value).slice(0, MAX_ERROR_DETAILS_LENGTH);
}

export function getErrorCode(value: unknown): string | null {
    return isRecord(value) && typeof value.code === 'string'
      ? value.code.slice(0, MAX_ERROR_CODE_LENGTH)
      : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
