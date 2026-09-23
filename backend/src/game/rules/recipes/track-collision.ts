import type { GameContext } from '../../engine/sdk/public-api';

type Context = {
  players: Pick<GameContext<object>['players'], 'all'>;
  movement: Pick<GameContext<object>['movement'], 'position'>;
};

/** Detect occupancy in player order; the caller decides the collision effect. */
export function firstOtherPlayerAt(
  ctx: Context,
  trackId: string,
  position: number,
  excludedPlayerId: number,
): number | undefined {
  return ctx.players
    .all()
    .find(
      (player) =>
        player.id !== excludedPlayerId &&
        ctx.movement.position(trackId, player.id) === position,
    )?.id;
}
