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
  const publicHttpMessage = httpClientMessage(value);
  return { message: publicHttpMessage ?? fallback };
}

function httpClientMessage(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const getStatus = value.getStatus;
  const getResponse = value.getResponse;
  if (typeof getStatus !== 'function' || typeof getResponse !== 'function') {
    return null;
  }
  const status = Number(getStatus.call(value));
  if (!Number.isInteger(status) || status < 400 || status >= 500) return null;
  const response: unknown = getResponse.call(value);
  if (typeof response === 'string') return response.trim() || null;
  if (!isRecord(response)) return null;
  const message = response.message;
  if (typeof message === 'string') return message.trim() || null;
  if (Array.isArray(message)) {
    const joined = message
      .filter((item) => typeof item === 'string')
      .join(', ');
    return joined.trim() || null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
