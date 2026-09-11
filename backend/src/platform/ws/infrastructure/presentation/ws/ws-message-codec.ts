export const WS_PROTOCOL_VERSION = 1 as const;
export type WsIncomingEnvelope = {
  type: string;
  payload?: unknown;
  requestId?: string;
  protocolVersion?: typeof WS_PROTOCOL_VERSION;
  clientVersion?: string;
};

/** One bounded JSON-envelope decoder for API and room websocket endpoints. */
export function decodeWsEnvelope(
  raw: unknown,
  maxBytes = 65_536,
): WsIncomingEnvelope | null {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1_048_576)
    return null;
  const text =
    typeof raw === 'string'
      ? raw
      : Buffer.isBuffer(raw)
        ? raw.toString('utf8')
        : raw instanceof ArrayBuffer
          ? Buffer.from(raw).toString('utf8')
          : null;
  if (
    text == null ||
    !text.trim() ||
    Buffer.byteLength(text, 'utf8') > maxBytes
  )
    return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isBoundedJsonInput(parsed)) return null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return null;
    const record = parsed as Record<string, unknown>;
    if (
      Object.keys(record).some(
        (key) =>
          ![
            'type',
            'payload',
            'requestId',
            'protocolVersion',
            'clientVersion',
          ].includes(key),
      )
    )
      return null;
    if (
      typeof record.type !== 'string' ||
      !record.type.trim() ||
      record.type.length > 100
    )
      return null;
    if (
      record.protocolVersion !== undefined &&
      record.protocolVersion !== WS_PROTOCOL_VERSION
    )
      return null;
    if (
      record.requestId !== undefined &&
      (typeof record.requestId !== 'string' ||
        !record.requestId.trim() ||
        record.requestId.length > 128)
    )
      return null;
    if (
      record.clientVersion !== undefined &&
      (typeof record.clientVersion !== 'string' ||
        !record.clientVersion.trim() ||
        record.clientVersion.length > 64)
    )
      return null;
    return record as WsIncomingEnvelope;
  } catch {
    return null;
  }
}
import { isBoundedJsonInput } from '../../../../validation/public-api';
