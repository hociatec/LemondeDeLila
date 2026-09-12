import type { DirectionalHazardRaceProgram } from './program';
import type { GameContext } from '../../definitions/game-author-context';

type Context = GameContext<Record<string, never>>;

export function incrementDirectionalHazardIdle(
  program: DirectionalHazardRaceProgram,
  actorId: number,
  delta: number,
  ctx: Context,
) {
  for (const player of ctx.players.all())
    ctx.resources.add(player.id, program.resources.idleTurns, 1);
  if (delta !== 0) ctx.resources.set(actorId, program.resources.idleTurns, 0);
}
export function directionalHazardMirrorSource(
  program: DirectionalHazardRaceProgram,
  playerId: number,
  ctx: Context,
) {
  const value = ctx.status.get(playerId, program.mirrorStatusId)?.data
    .sourcePlayerId;
  return typeof value === 'number' ? value : null;
}
