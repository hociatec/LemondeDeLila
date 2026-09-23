import type { GameContext } from '../../../engine/sdk/public-api';
import type { DirectionalHazardRaceProgram } from './program';
import type { DirectionalHazardGlobalEffect as Global } from './directional-hazard-effect-types';
import {
  assignDirectionalHazardPositions as assign,
  moveAllDirectionalHazardPlayers as moveAll,
  directionalHazardPosition as position,
  rankedDirectionalHazardPlayerIds as rankedIds,
} from './directional-hazard-movement';
type Context = GameContext<Record<string, never>>;
export function applyGlobal(
  program: DirectionalHazardRaceProgram,
  effect: Global,
  ctx: Context,
) {
  const ids = ctx.players.all().map((player) => player.id);
  if (effect === 'shuffle')
    assign(
      program,
      ids,
      ctx.random.shuffle(ids.map((id) => position(program, id, ctx))),
      ctx,
    );
  else if (effect === 'reverse-ranking') {
    const ranked = rankedIds(program, ids, 'asc', ctx);
    assign(
      program,
      ranked,
      ranked.map((id) => position(program, id, ctx)).reverse(),
      ctx,
    );
  } else if (effect === 'skip-all') for (const id of ids) ctx.turn.skip(id, 1);
  else if (effect === 'advance-all')
    moveAll(program, ids, program.parameters.globalAdvance, ctx);
  else if (effect === 'retreat-all')
    moveAll(program, ids, program.parameters.globalRetreat, ctx);
  else if (effect === 'cycle-ranking') {
    const ranked = rankedIds(program, ids, 'desc', ctx);
    const values = ranked.map((id) => position(program, id, ctx));
    assign(
      program,
      ranked,
      values.map((_value, index) => values[(index + 1) % values.length]),
      ctx,
    );
  } else if (effect === 'random-roll-all')
    for (const id of ids)
      ctx.movement.moveTo(
        program.trackId,
        id,
        ctx.movement.preview(
          program.trackId,
          id,
          ctx.random.int(program.parameters.randomSides) + 1,
        ),
      );
}
