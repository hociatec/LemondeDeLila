import { defineAction } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import { GameRuleViolationError } from '../contracts/game-domain.errors';
import type { GameContext } from '../definitions/game-author-context';
import { defineEvent } from '../events/game-event-definition';
import { clockwise } from '../kits/turn-kit';
import { definePattern } from './gameplay-pattern-core';
import { completeRound } from './pattern-capabilities';

export type JudgedSubmissionOptions = {
  submitRecipe: string;
  pickRecipe: string;
  submitAction: string;
  pickAction: string;
  judgeId: string;
  submissionId: string;
  promptDeckId: string;
  answerDeckId: string;
  answerHandId: string;
  collectingPhase: string;
  judgingPhase: string;
  scoreToWin: number;
  winningReason: string;
  submittedMessage: string;
  revealedEvent: string;
  botSelection: 'first' | 'random';
};

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = { id: string };

export function judgedSubmission(source: JudgedSubmissionOptions) {
  const options = structuredClone(source);
  const revealed = defineEvent({
    type: options.revealedEvent,
    data: gameInput.object({
      count: gameInput.number({ integer: true, min: 0 }),
    }),
  });
  const submittedPlayers = (ctx: Context) =>
    Object.keys(ctx.submissions.values(options.submissionId))
      .map(Number)
      .sort((a, b) => a - b);
  const select = <T>(ctx: Context, candidates: readonly T[]) =>
    (options.botSelection === 'random'
      ? ctx.random.pick(candidates)
      : candidates[0]) ?? null;
  return definePattern({
    id: `judged-submission:${options.submissionId}`,
    mechanics: ['cards', 'submissions', 'judge', 'rounds', 'score'],
    turn: clockwise(),
    events: [revealed],
    setup: ({ ctx }) => {
      const players = ctx.players.all().map((player) => player.id);
      const judge = ctx.submissionFlow.startJudge(options.judgeId, { players });
      const { participantPlayerIds } = ctx.submissionFlow.openForJudge({
        submissionId: options.submissionId,
        judgeId: options.judgeId,
        players,
        secret: true,
      });
      ctx.round.start(judge, participantPlayerIds);
      ctx.turn.to(participantPlayerIds[0] ?? judge);
      drawPrompt(options, ctx);
      return {};
    },
    actions: {
      [options.submitRecipe]: defineAction<State, { cardId: string }>({
        input: gameInput.object({ cardId: gameInput.cardId() }),
        available: ({ actor, ctx }) =>
          ctx.phase.current() === options.collectingPhase &&
          ctx.round.activePlayers().some((player) => player.id === actor.id),
        validate: ({ actor, input, ctx }) =>
          ctx.cards
            .hand<Card>(options.answerHandId, actor.id)
            .some((card) => card.id === input.cardId),
        enumerate: ({ actor, ctx }) =>
          ctx.cards
            .hand<Card>(options.answerHandId, actor.id)
            .map((card) => ({ cardId: card.id })),
        execute: ({ actor, input, ctx }) => {
          submitCard(options, actor.id, input.cardId, ctx);
          const pending = ctx.submissions.pendingPlayers(options.submissionId);
          ctx.events.message(options.submittedMessage, { playerId: actor.id });
          if (pending.length) ctx.turn.to(pending[0]);
          else {
            ctx.phase.transitionTo(options.judgingPhase);
            ctx.submissionFlow.reveal(options.submissionId);
            ctx.turn.to(ctx.judge.current(options.judgeId));
            revealed.emit(ctx, { count: submittedPlayers(ctx).length });
          }
        },
      }),
      [options.pickRecipe]: defineAction<State, { winnerId: number }>({
        input: gameInput.object({ winnerId: gameInput.playerId() }),
        available: ({ actor, ctx }) =>
          ctx.phase.current() === options.judgingPhase &&
          actor.id === ctx.judge.current(options.judgeId),
        validate: ({ input, ctx }) =>
          submittedPlayers(ctx).includes(input.winnerId),
        enumerate: ({ ctx }) =>
          submittedPlayers(ctx).map((winnerId) => ({ winnerId })),
        execute: ({ input, ctx }) => {
          ctx.score.add(input.winnerId, 1);
          ctx.events.message('game.round.won', { playerId: input.winnerId });
          completeRound(ctx, {
            winnerPlayerIds: [input.winnerId],
            finishMatch: () => {
              if (ctx.score.get(input.winnerId) < options.scoreToWin)
                return false;
              ctx.match.finish({
                winners: [input.winnerId],
                reason: options.winningReason,
              });
              return true;
            },
            reset: () => nextRound(options, ctx),
            next: false,
          });
        },
      }),
    },
    bot: {
      choose: ({ actor, ctx, availableActions }) => {
        const judging = ctx.phase.current() === options.judgingPhase;
        const type = judging ? options.pickAction : options.submitAction;
        if (!availableActions.includes(type)) return null;
        if (judging) {
          const winnerId = select(ctx, submittedPlayers(ctx));
          return winnerId == null ? null : { type, payload: { winnerId } };
        }
        const cardId = select(
          ctx,
          ctx.cards
            .hand<Card>(options.answerHandId, actor.id)
            .map((card) => card.id),
        );
        return cardId == null ? null : { type, payload: { cardId } };
      },
    },
  });
}

function submitCard(
  options: JudgedSubmissionOptions,
  playerId: number,
  cardId: string,
  ctx: Context,
): void {
  const card = ctx.cards
    .hand<Card>(options.answerHandId, playerId)
    .find((item) => item.id === cardId);
  if (!card) throw new GameRuleViolationError('CARD_NOT_IN_HAND');
  ctx.cards.play(options.answerHandId, options.answerDeckId, playerId, card);
  ctx.submissionFlow.submit(options.submissionId, playerId, cardId);
  const replacement = ctx.cards.draw<Card>(options.answerDeckId);
  if (replacement) ctx.cards.give(options.answerHandId, playerId, replacement);
  ctx.round.leave(playerId);
}

function nextRound(options: JudgedSubmissionOptions, ctx: Context): void {
  const { judgePlayerId, participantPlayerIds } =
    ctx.submissionFlow.openForJudge({
      submissionId: options.submissionId,
      judgeId: options.judgeId,
      players: ctx.players.all().map((player) => player.id),
      secret: true,
      rotateJudge: true,
    });
  drawPrompt(options, ctx);
  ctx.phase.transitionTo(options.collectingPhase);
  ctx.round.start(judgePlayerId, participantPlayerIds);
  ctx.turn.to(participantPlayerIds[0] ?? judgePlayerId);
}

function drawPrompt(options: JudgedSubmissionOptions, ctx: Context): void {
  const card = ctx.cards.draw<Card>(options.promptDeckId);
  if (card) ctx.cards.discard(options.promptDeckId, card);
}
