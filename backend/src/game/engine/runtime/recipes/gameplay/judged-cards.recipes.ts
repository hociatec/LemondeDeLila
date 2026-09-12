import type { JudgedCardsProgram } from '../../extensions/judged-cards/program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import { defineEvent } from '../../events/game-event-definition';
import { completeRound } from './track-round.recipes';
import { clockwise } from '../../kits/turn-kit';
import { GameRuleViolationError } from '../../../../core/domain/errors/game-domain.errors';

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = { id: string };

export function judgedCardsRules(source: JudgedCardsProgram) {
  const program = structuredClone(source);
  const revealed = defineEvent({
    type: program.revealedEvent,
    data: gameInput.object({
      count: gameInput.number({ integer: true, min: 0 }),
    }),
  });
  const submit = defineAction<State, { cardId: string }>({
    input: gameInput.object({ cardId: gameInput.cardId() }),
    available: ({ actor, ctx }) =>
      ctx.phase.current() === program.collectingPhase &&
      ctx.round.activePlayers().some((p) => p.id === actor.id),
    validate: ({ actor, input, ctx }) =>
      ctx.cards
        .hand<Card>(program.answerHandId, actor.id)
        .some((c) => c.id === input.cardId),
    enumerate: ({ actor, ctx }) =>
      ctx.cards
        .hand<Card>(program.answerHandId, actor.id)
        .map((c) => ({ cardId: c.id })),
    execute: ({ actor, input, ctx }) => {
      submitCard(program, actor.id, input.cardId, ctx);
      const pending = ctx.submissions.pendingPlayers(program.submissionId);
      ctx.events.message(program.submittedMessage, { playerId: actor.id });
      if (pending.length) ctx.turn.to(pending[0]);
      else {
        ctx.phase.transitionTo(program.judgingPhase);
        ctx.submissionFlow.reveal(program.submissionId);
        ctx.turn.to(ctx.judge.current(program.judgeId));
        revealed.emit(ctx, { count: submittedPlayers(program, ctx).length });
      }
    },
  });
  const pick = judgeAction(program);
  return {
    submit,
    pick,
    events: [revealed],
    pattern: {
      id: `card-game:${program.answerDeckId}:${program.answerHandId}`,
      mechanics: ['cards', 'hands', 'deck-lifecycle'],
      turn: clockwise(),
    },
    setup: ({ ctx }: { ctx: Context }): State => {
      const players = ctx.players.all().map((p) => p.id);
      const judge = ctx.submissionFlow.startJudge(program.judgeId, { players });
      const { participantPlayerIds } = ctx.submissionFlow.openForJudge({
        submissionId: program.submissionId,
        judgeId: program.judgeId,
        players,
        secret: true,
      });
      ctx.round.start(judge, participantPlayerIds);
      ctx.turn.to(participantPlayerIds[0] ?? judge);
      drawPrompt(program, ctx);
      return {};
    },
    chooseCard: (ctx: Context, playerId: number) =>
      select(
        program,
        ctx,
        ctx.cards.hand<Card>(program.answerHandId, playerId).map((c) => c.id),
      ),
    chooseWinner: (ctx: Context) =>
      select(program, ctx, submittedPlayers(program, ctx)),
  };
}
function submitCard(
  program: JudgedCardsProgram,
  playerId: number,
  cardId: string,
  ctx: Context,
): void {
  const card = ctx.cards
    .hand<Card>(program.answerHandId, playerId)
    .find((c) => c.id === cardId);
  if (!card) throw new GameRuleViolationError('CARD_NOT_IN_HAND');
  ctx.cards.play(program.answerHandId, program.answerDeckId, playerId, card);
  ctx.submissionFlow.submit(program.submissionId, playerId, cardId);
  const replacement = ctx.cards.draw<Card>(program.answerDeckId);
  if (replacement) ctx.cards.give(program.answerHandId, playerId, replacement);
  ctx.round.leave(playerId);
}

function judgeAction(program: JudgedCardsProgram) {
  return defineAction<State, { winnerId: number }>({
    input: gameInput.object({ winnerId: gameInput.playerId() }),
    available: ({ actor, ctx }) =>
      ctx.phase.current() === program.judgingPhase &&
      actor.id === ctx.judge.current(program.judgeId),
    validate: ({ input, ctx }) =>
      submittedPlayers(program, ctx).includes(input.winnerId),
    enumerate: ({ ctx }) =>
      submittedPlayers(program, ctx).map((winnerId) => ({ winnerId })),
    execute: ({ input, ctx }) => {
      ctx.score.add(input.winnerId, 1);
      ctx.events.message('game.round.won', { playerId: input.winnerId });
      completeRound(ctx, {
        winnerPlayerIds: [input.winnerId],
        finishMatch: () => {
          if (ctx.score.get(input.winnerId) < program.scoreToWin) return false;
          ctx.match.finish({
            winners: [input.winnerId],
            reason: program.winningReason,
          });
          return true;
        },
        reset: () => nextRound(program, ctx),
        next: false,
      });
    },
  });
}

function nextRound(program: JudgedCardsProgram, ctx: Context): void {
  const { judgePlayerId, participantPlayerIds } =
    ctx.submissionFlow.openForJudge({
      submissionId: program.submissionId,
      judgeId: program.judgeId,
      players: ctx.players.all().map((p) => p.id),
      secret: true,
      rotateJudge: true,
    });
  drawPrompt(program, ctx);
  ctx.phase.transitionTo(program.collectingPhase);
  ctx.round.start(judgePlayerId, participantPlayerIds);
  ctx.turn.to(participantPlayerIds[0] ?? judgePlayerId);
}

function drawPrompt(program: JudgedCardsProgram, ctx: Context): void {
  const card = ctx.cards.draw<Card>(program.promptDeckId);
  if (card) ctx.cards.discard(program.promptDeckId, card);
}

function submittedPlayers(program: JudgedCardsProgram, ctx: Context): number[] {
  return Object.keys(ctx.submissions.values(program.submissionId))
    .map(Number)
    .sort((a, b) => a - b);
}

function select<T>(
  program: JudgedCardsProgram,
  ctx: Context,
  candidates: readonly T[],
): T | null {
  return (
    (program.botSelection === 'random'
      ? ctx.random.pick(candidates)
      : candidates[0]) ?? null
  );
}
