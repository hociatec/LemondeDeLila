const DEFAULT_MINIMUM_PARTICIPANTS = 2;

export function resolveMinimumParticipants(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_MINIMUM_PARTICIPANTS;
  }
  return Math.max(1, Math.trunc(parsed));
}

export function hasMinimumParticipants(
  humans: number,
  bots: number,
  minimum: number,
): boolean {
  const humanCount = Number.isFinite(humans)
    ? Math.max(0, Math.trunc(humans))
    : 0;
  const botCount = Number.isFinite(bots) ? Math.max(0, Math.trunc(bots)) : 0;
  return humanCount + botCount >= resolveMinimumParticipants(minimum);
}

export function buildMinimumParticipantsMessage(minimum: number): string {
  const required = resolveMinimumParticipants(minimum);
  return required === 1
    ? 'Au moins un participant est requis'
    : `Au moins ${required} participants sont requis`;
}
/** Room application capability boundary. */
