import type { LamaMetadata } from '../../model/lama.model';

/**
 * Official LAMA rule: as soon as a player leaves the current round, nobody
 * still active may draw. Players eliminated in an earlier round are ignored.
 */
export function isLamaDrawLocked(meta: LamaMetadata): boolean {
  const dropped = meta.droppedOutByPlayerId ?? {};
  const roundHands = meta.handsByPlayerId ?? {};
  return Object.keys(roundHands).some((playerId) => Boolean(dropped[playerId]));
}
