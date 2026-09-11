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
  const safeFallback = typeof fallback === 'string' ? fallback.slice(0, 2_000) : 'Erreur inconnue';
  if (
    isRecord(value) &&
    value.presentToClient === 'code' &&
    typeof value.code === 'string' &&
    value.code.trim().length > 0
  ) {
    return {
      code: value.code.trim().slice(0, 128),
      params: boundedParams(value.details),
    };
  }
  const publicHttpMessage = httpClientMessage(value);
  return { message: publicHttpMessage ?? safeFallback };
}

function httpClientMessage(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const getStatus = value.getStatus;
  const getResponse = value.getResponse;
  if (typeof getStatus !== 'function' || typeof getResponse !== 'function') {
    return null;
  }
  let status: number;
  let response: unknown;
  try {
    status = Number(getStatus.call(value));
    response = getResponse.call(value);
  } catch {
    return null;
  }
  if (!Number.isInteger(status) || status < 400 || status >= 500) return null;
  if (typeof response === 'string') return response.trim().slice(0, 2_000) || null;
  if (!isRecord(response)) return null;
  const message = response.message;
  if (typeof message === 'string') return message.trim().slice(0, 2_000) || null;
  if (Array.isArray(message)) {
    const joined = message
      .filter((item) => typeof item === 'string')
      .join(', ');
    return joined.trim().slice(0, 2_000) || null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedParams(value: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) return {};
  const entries = Object.entries(value).slice(0, 32);
  const result: Record<string, unknown> = {};
  for (const [key, item] of entries) {
    if (key.length <= 128) {
      result[key] = boundedParamValue(item, 0);
    }
  }
  return result;
}

function boundedParamValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return value.slice(0, 2_000);
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (depth >= 2) return '[TRUNCATED]';
  if (Array.isArray(value)) {
    return value.slice(0, 32).map((item) => boundedParamValue(item, depth + 1));
  }
  if (!isRecord(value)) return '[TRUNCATED]';
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, 32)) {
    if (key.length <= 128) result[key] = boundedParamValue(item, depth + 1);
  }
  return result;
}
