export type PresentedErrorPayload =
  | { message: string }
  | {
      code: string;
      params: Readonly<Record<string, unknown>>;
    };

export function getErrorPayload(
  value: unknown,
  fallback = 'Erreur inconnue',
): PresentedErrorPayload {
  if (
    isRecord(value) &&
    value.presentToClient === 'code' &&
    typeof value.code === 'string' &&
    value.code.trim().length > 0
  ) {
    return {
      code: value.code.trim(),
      params: isRecord(value.details) ? value.details : {},
    };
  }
  return { message: errorMessage(value, fallback) };
}

function errorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error) return value.message.trim() || fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (isRecord(value) && typeof value.message === 'string') {
    return value.message.trim() || fallback;
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
