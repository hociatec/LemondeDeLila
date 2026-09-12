import type { GameContext } from '../../definitions/game-author-context';
import type { DirectionalHazardRaceProgram } from './program';

type Context = GameContext<Record<string, never>>;

export function directionalHazardPosition(
  program: DirectionalHazardRaceProgram,
  id: number,
  ctx: Context,
) {
  return ctx.movement.position(program.trackId, id);
}

export function rankedDirectionalHazardPlayerIds(
  program: DirectionalHazardRaceProgram,
  ids: number[],
  direction: 'asc' | 'desc',
  ctx: Context,
) {
  return ctx.ranking
    .rank(ids, {
      value: (id) => directionalHazardPosition(program, id, ctx),
      direction,
    })
    .map((entry) => entry.playerId);
}

export function moveAllDirectionalHazardPlayers(
  program: DirectionalHazardRaceProgram,
  ids: number[],
  delta: number,
  ctx: Context,
) {
  for (const id of ids)
    ctx.movement.moveTo(
      program.trackId,
      id,
      Math.min(
        program.tiles.length - 1,
        Math.max(0, directionalHazardPosition(program, id, ctx) + delta),
      ),
    );
}

export function assignDirectionalHazardPositions(
  program: DirectionalHazardRaceProgram,
  ids: number[],
  values: number[],
  ctx: Context,
) {
  ids.forEach((id, index) =>
    ctx.movement.moveTo(program.trackId, id, values[index] ?? 0),
  );
}
