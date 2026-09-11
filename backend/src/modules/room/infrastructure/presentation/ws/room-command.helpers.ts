export function isImmediateAckAction(type: string | undefined): boolean {
  return (
    type === 'room.start' ||
    type === 'room.reset' ||
    type === 'bot.add' ||
    type === 'bot.remove' ||
    type === 'room.toggle-privacy' ||
    type === 'room.kick' ||
    type === 'room.ban' ||
    type === 'room.set-owner' ||
    type === 'room.set-ambience'
  );
}

export function extractTraceMeta(
  payload: unknown,
  receivedAtMs: number,
): { traceId: string | null; clientToServerMs: number | null } {
  const row = asRecord(payload);
  const trace = asRecord(row._trace);
  const traceId =
    typeof trace.id === 'string' ? String(trace.id).slice(0, 128) : undefined;
  const sentAtMs =
    typeof trace.sentAtMs === 'number' ? Number(trace.sentAtMs) : undefined;

  const id =
    typeof traceId === 'string' && traceId.trim().length > 0
      ? traceId.trim()
      : null;

  const c2s =
    typeof sentAtMs === 'number' && Number.isFinite(sentAtMs)
      ? Math.min(Math.max(0, receivedAtMs - sentAtMs), 86_400_000)
      : null;

  return { traceId: id, clientToServerMs: c2s };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
