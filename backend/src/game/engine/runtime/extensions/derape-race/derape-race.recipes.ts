import { GameRuleViolationError } from '../../../../core/domain/errors/game-domain.errors';
import { defineAction, defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import type { DerapeRaceProgram } from './program';
import type { GameContext } from '../../definitions/game-author-context';
import { commonStatuses } from '../../kits/player-values-contracts';
import { derapeEffects, moveDerapePlayer } from './derape-race-effects';
import { derapeMirrorSource, incrementDerapeIdle } from './derape-race-turn';

type State = Record<string, never>;
type Context = GameContext<State>;

export function derapeRaceRules(source: DerapeRaceProgram) {
  const program = structuredClone(source);
  return {
    roll: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      execute: ({ actor, ctx }) => executeRoll(program, actor.id, ctx),
      documentation: 'Lance le dé et résout les cartes Situation en chaîne.',
    }),
    choices: {
      [program.nextDeltaChoiceId]: defineChoice<State, number>({
        input: gameInput.number({ integer: true }),
        resolve: ({ value, ctx }) => {
          const pending = ctx.choice.consumeContinuation<{
            kind: 'next-delta';
            actorId: number;
          }>();
          if (pending?.kind !== 'next-delta' || (value !== -1 && value !== 1))
            throw new GameRuleViolationError('DERAPE_NEXT_DELTA_INVALID');
          ctx.counters.set(program.counterId, value);
          ctx.turn.complete();
        },
      }),
    },
    effects: derapeEffects(program),
  };
}
function executeRoll(
  program: DerapeRaceProgram,
  actorId: number,
  ctx: Context,
) {
  const source = derapeMirrorSource(program, actorId, ctx);
  let value =
    source == null ? 0 : ctx.resources.get(source, program.resources.lastRoll);
  if (value <= 0) value = ctx.dice.roll(program.diceId).total;
  ctx.status.remove(actorId, program.mirrorStatusId);
  if (ctx.status.consume(actorId, commonStatuses.doubleRoll)) value *= 2;
  ctx.resources.set(actorId, program.resources.lastRoll, value);
  let delta = value + ctx.counters.get(program.counterId);
  ctx.counters.set(program.counterId, 0);
  if (ctx.status.consume(actorId, commonStatuses.doubleMove)) delta *= 2;
  incrementDerapeIdle(program, actorId, delta, ctx);
  moveDerapePlayer(program, actorId, delta, true, ctx);
  ctx.events.message('game.dice.rolled', {
    playerId: actorId,
    diceId: program.diceId,
    total: value,
  });
  ctx.turn.complete();
}
