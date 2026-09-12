import type { BoardGameProgram } from '../../effect-packs/board-movement-landings/program';
import { gameInput } from '../../actions/game-input-schema';
type State = Record<string, never>;
import { defineEffect } from '../../effects/effects-core';
import type { GameEffectResolverShape } from '../../contracts/effect-resolver';
import { BoardLandingResolver } from './board-landings';

export function boardEffectBindings(
  program: BoardGameProgram,
  board: BoardLandingResolver<State>,
) {
  const effects: Record<string, GameEffectResolverShape<State>> = {};
  for (const [id, binding] of Object.entries(program.bindings)) {
    if (binding.kind === 'move')
      effects[id] = defineEffect<State, { delta: number }>({
        input: gameInput.object(
          { delta: gameInput.number({ integer: true, coerce: false }) },
          { unknownKeys: 'reject' },
        ),
        apply: ({ actorPlayerId, data, ctx }) => {
          if (actorPlayerId != null)
            board.move(actorPlayerId, data.delta, 0, ctx);
        },
      });
    else if (binding.kind === 'collect')
      effects[id] = defineEffect<State, { count: number; everyone: boolean }>({
        input: gameInput.object(
          {
            count: gameInput.number({
              integer: true,
              min: 1,
              max: 100,
              coerce: false,
            }),
            everyone: gameInput.boolean(),
          },
          { unknownKeys: 'reject' },
        ),
        apply: ({ actorPlayerId, data, ctx }) => {
          const ids = data.everyone
            ? ctx.players.all().map((player) => player.id)
            : actorPlayerId == null
              ? []
              : [actorPlayerId];
          for (const id of ids)
            for (let n = 0; n < data.count; n++)
              board.collect(id, undefined, ctx);
        },
      });
    else
      effects[id] = defineEffect<State, Record<string, never>>({
        input: gameInput.object({}, { unknownKeys: 'reject' }),
        apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
          if (actorPlayerId == null) return;
          if (binding.kind === 'quiz') board.quiz(actorPlayerId, ctx);
          else if (binding.kind === 'nearest')
            board.nearest(actorPlayerId, binding.tag, 0, ctx);
          else if (targetPlayerIds[0] != null)
            board.exchange(actorPlayerId, targetPlayerIds[0], ctx);
        },
      });
  }
  return effects;
}
