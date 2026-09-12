import type { BoardGameProgram } from '../../extensions/board-game/program';
import type { GameContext } from '../../definitions/game-author-context';
import { gameInput } from '../../actions/game-input-schema';
type State = Record<string, never>;
type Context = GameContext<State>;
import { defineChoice } from '../../actions/action-builders';
import type { ChoiceResolverShape } from '../../contracts/author-rule-contracts';
import { GameRuleViolationError } from '../../../../core/domain/errors/game-domain.errors';
import { BoardLandingResolver, type BoardContinuation } from './board-landings';

export function boardChoices(
  program: BoardGameProgram,
  board: BoardLandingResolver<State>,
  finish: (ctx: Context) => void,
) {
  const choices: Record<string, ChoiceResolverShape<State>> = {};
  const directionId = program.directionChoiceId;
  if (directionId)
    choices[directionId] = defineChoice<State, string>({
      input: gameInput.enum(['forward', 'backward']),
      resolve: ({ actor, value, ctx }) => {
        const pending = continuation(ctx, actor.id, 'direction');
        board.move(
          actor.id,
          value === 'forward' ? pending.distance : -pending.distance,
          0,
          ctx,
        );
        finish(ctx);
      },
    });
  const quiz = program.quiz;
  if (quiz)
    choices[quiz.choiceId] = defineChoice<State, number>({
      input: gameInput.number({ integer: true, min: 0 }),
      resolve: ({ actor, value, ctx }) => {
        const pending = continuation(ctx, actor.id, 'quiz');
        const { correct } = ctx.quiz.answer(pending.sessionId, actor.id, value);
        ctx.quiz.close(pending.sessionId);
        ctx.events.message('game.quiz.answered', {
          playerId: actor.id,
          correct,
          reward: correct ? quiz.correctMove : 0,
        });
        if (correct) board.move(actor.id, quiz.correctMove, 0, ctx);
        finish(ctx);
      },
    });
  addExchangeChoices(program, choices, finish);
  return choices;
}

function continuation<K extends BoardContinuation['kind']>(
  ctx: Context,
  actorId: number,
  kind: K,
): Extract<BoardContinuation, { kind: K }> {
  const pending = ctx.choice.consumeContinuation<BoardContinuation>();
  if (!pending || pending.actorId !== actorId || pending.kind !== kind)
    throw new GameRuleViolationError('BOARD_CONTINUATION_INVALID');
  return pending as Extract<BoardContinuation, { kind: K }>;
}

function addExchangeChoices(
  program: BoardGameProgram,
  choices: Record<string, ChoiceResolverShape<State>>,
  finish: (ctx: Context) => void,
): void {
  const exchange = program.exchange;
  if (exchange) {
    choices[exchange.takeChoiceId] = defineChoice<State, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => {
        const pending = continuation(ctx, actor.id, 'take');
        if (!ctx.inventory.has(exchange.inventoryId, pending.targetId, value))
          throw new GameRuleViolationError('BOARD_EXCHANGE_ITEM_MISSING');
        const own = ctx.inventory.items(exchange.inventoryId, actor.id);
        if (!own.length) {
          ctx.inventory.transfer(
            exchange.inventoryId,
            pending.targetId,
            actor.id,
            value,
          );
          finish(ctx);
          return;
        }
        ctx.choice.one({
          id: exchange.giveChoiceId,
          player: actor.id,
          options: own,
          data: {
            kind: 'give',
            actorId: actor.id,
            targetId: pending.targetId,
            take: value,
          } satisfies BoardContinuation,
        });
      },
    });
    choices[exchange.giveChoiceId] = defineChoice<State, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => {
        const pending = continuation(ctx, actor.id, 'give');
        ctx.inventory.exchange(
          exchange.inventoryId,
          pending.targetId,
          pending.take,
          actor.id,
          value,
        );
        finish(ctx);
      },
    });
  }
}
