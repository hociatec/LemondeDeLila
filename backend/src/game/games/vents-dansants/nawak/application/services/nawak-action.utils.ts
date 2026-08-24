import type { GameStateEntity } from '../../../../../application/models/game-state.model';

export function getNawakPlayerIds(
  players?: GameStateEntity['players'],
): number[] {
  return (Array.isArray(players) ? players : [])
    .filter((player) => typeof player?.id === 'number')
    .map((player) => player.id);
}
