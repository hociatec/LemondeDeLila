import { parseStrictInteger } from '@shared/utils/public-api';

const DEFAULT_MINIMUM_PARTICIPANTS = 2;

export function resolveMinimumParticipants(value: unknown): number {
  // Every table game is multiplayer. Clamp legacy catalog overrides as well
  // as malformed manifests so a single participant can never start a match.
  return (
    parseStrictInteger(value, { min: DEFAULT_MINIMUM_PARTICIPANTS }) ??
    DEFAULT_MINIMUM_PARTICIPANTS
  );
}

export function hasMinimumParticipants(
  humans: number,
  bots: number,
  minimum: number,
): boolean {
  const humanCount = Number.isSafeInteger(humans)
    ? Math.min(64, Math.max(0, humans))
    : 0;
  const botCount = Number.isSafeInteger(bots)
    ? Math.min(64, Math.max(0, bots))
    : 0;
  return humanCount + botCount >= resolveMinimumParticipants(minimum);
}

export function buildMinimumParticipantsMessage(minimum: number): string {
  const required = resolveMinimumParticipants(minimum);
  return `Au moins ${required} participants sont requis`;
}
/** Room application capability boundary. */
