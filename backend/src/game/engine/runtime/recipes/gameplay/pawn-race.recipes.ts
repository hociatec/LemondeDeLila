import { defineAction, defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import type { PawnRaceProgram } from '../../extensions/pawn-race/program';
import type { GameContext } from '../../definitions/game-author-context';
import type { PawnMove } from '../../kits/pawn-kit';
import { GameRuleViolationError } from '../../../../core/domain/errors/game-domain.errors';

type State = Record<string, never>;
type Context = GameContext<State>;
type Move = PawnMove & { roll: number };

export function pawnRaceRules(source: PawnRaceProgram) {
  const program = structuredClone(source);
  const end = (ctx: Context, total: number) => {
    if (program.extraTurnRolls?.includes(total)) ctx.turn.extra();
    ctx.turn.end();
  };
  const move = (ctx: Context, playerId: number, selected: Move) => {
    ctx.pawns.applyRaceMove(program.setId, playerId, selected, {
      finishAt: program.finishAt,
      afterMove: () =>
        ctx.events.message('game.pawn.moved', {
          playerId,
          pawnId: selected.pawnId,
          target: selected.to,
        }),
      onFinish: () =>
        ctx.match.finish({
          winners: [playerId],
          reason: program.finishReason,
        }),
    });
  };
  return {
    roll: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      execute: ({ actor, ctx }) => {
        const total = ctx.dice.roll(program.diceId).total;
        ctx.events.message('game.dice.rolled', {
          playerId: actor.id,
          diceId: program.diceId,
          total,
        });
        const moves = ctx.pawns
          .legalMoves(program.setId, actor.id, total)
          .map((candidate) => ({ ...candidate, roll: total }));
        if (moves.length === 0) {
          ctx.events.message('game.pawn.no-legal-move', { playerId: actor.id });
          end(ctx, total);
        } else if (moves.length === 1) {
          move(ctx, actor.id, moves[0]);
          if (ctx.match.lifecycle() !== 'finished') end(ctx, total);
        } else {
          const names = new Map(
            ctx.pawns
              .definitions(program.setId)
              .map((pawn) => [pawn.id, pawn.label ?? pawn.name ?? pawn.id]),
          );
          ctx.choice.one({
            id: program.choiceId,
            player: actor.id,
            options: moves,
            label: (selected) =>
              `${names.get(selected.pawnId)} → ${selected.to}`,
          });
        }
      },
    }),
    choices: {
      [program.choiceId]: defineChoice<State, Move>({
        input: gameInput.object({
          pawnId: gameInput.string({ min: 1, max: 128 }),
          from: gameInput.number({ integer: true }),
          to: gameInput.number({ integer: true }),
          distance: gameInput.number({ integer: true }),
          roll: gameInput.number({ integer: true, min: 1 }),
        }),
        resolve: ({ actor, value, ctx }) => {
          const total = ctx.dice.last(program.diceId)?.total;
          if (total == null)
            throw new GameRuleViolationError('PAWN_RACE_ROLL_MISSING');
          move(ctx, actor.id, value);
          if (ctx.match.lifecycle() !== 'finished') end(ctx, total);
        },
      }),
    },
  };
}
