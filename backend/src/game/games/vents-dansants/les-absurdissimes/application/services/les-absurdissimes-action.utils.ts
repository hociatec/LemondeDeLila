import type { GameStateEntity } from '../../../../application/models/game-state.model';

import type { AbsurdissimesMetadata } from '../../model/les-absurdissimes-state.model';

export function getAbsurdissimesPlayerIds(
  players?: GameStateEntity['players'],
): number[] {
  return (Array.isArray(players) ? players : [])
    .filter((player) => typeof player?.id === 'number')
    .map((player) => player.id);
}

export function getAbsurdissimesJudgeId(
  state: GameStateEntity,
  meta: AbsurdissimesMetadata,
): number | null {
  const players = getAbsurdissimesPlayerIds(state.players);
  if (!players.length) return null;
  const index = meta.judgeIndex % players.length;
  return players[index] ?? players[0] ?? null;
}
