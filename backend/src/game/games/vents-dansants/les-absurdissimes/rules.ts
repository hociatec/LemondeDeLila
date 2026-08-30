import {
  completeRound,
  defineAction,
  defineEvent,
  defineGamePhases,
  gameInput,
  rejectRule,
  type GameContext,
} from '../../../engine/sdk/public-api';
import type { AbsurdissimesCard } from './content';
import type { NoGameState as AbsurdissimesState } from '../../../engine/sdk/public-api';

const HAND = 'answers';
const BLACK_DECK = 'black';
const WHITE_DECK = 'white';
export const ABSURDISSIMES_ANSWERS = 'absurdissimes.answers';
export const ABSURDISSIMES_JUDGE = 'absurdissimes.judge';
export const ABSURDISSIMES_TARGET_SCORE = 10;
export const SUBMISSIONS_REVEALED = defineEvent({
  type: 'absurdissimes.submissions.revealed',
  data: gameInput.object({
    count: gameInput.number({ integer: true, min: 0 }),
  }),
});
export const ABSURDISSIMES_PHASES = defineGamePhases<AbsurdissimesState>()({
  initialPhase: 'play',
  phases: { play: {}, judge: {} },
});

export const playCard = defineAction<AbsurdissimesState, { cardId: string }>({
  input: gameInput.object({ cardId: gameInput.cardId() }),
  available: ({ actor, ctx }) =>
    ABSURDISSIMES_PHASES.is(ctx, 'play') &&
    ctx.round.activePlayers().some((player) => player.id === actor.id),
  validate: ({ actor, input, ctx }) =>
    ctx.cards
      .hand<AbsurdissimesCard>(HAND, actor.id)
      .some((card) => card.id === input.cardId),
  enumerate: ({ actor, ctx }) =>
    ctx.cards
      .hand<AbsurdissimesCard>(HAND, actor.id)
      .map((card) => ({ cardId: card.id })),
  execute: ({ actor, input, ctx }) => {
    const card = ctx.cards
      .hand<AbsurdissimesCard>(HAND, actor.id)
      .find((candidate) => candidate.id === input.cardId);
    if (!card) return rejectRule('Carte Absurdissimes absente de la main');
    ctx.cards.play(HAND, BLACK_DECK, actor.id, card);
    ctx.submissionFlow.submit(ABSURDISSIMES_ANSWERS, actor.id, input.cardId);
    const replacement = ctx.cards.draw<AbsurdissimesCard>(BLACK_DECK);
    if (replacement) ctx.cards.give(HAND, actor.id, replacement);
    ctx.round.leave(actor.id);
    const remainingPlayers = ctx.submissions.pendingPlayers(
      ABSURDISSIMES_ANSWERS,
    );
    ctx.events.message('absurdissimes.answer.submitted', {
      playerId: actor.id,
    });
    if (remainingPlayers.length === 0) {
      ABSURDISSIMES_PHASES.transition(ctx, 'judge');
      ctx.submissionFlow.reveal(ABSURDISSIMES_ANSWERS);
      ctx.turn.to(ctx.judge.current(ABSURDISSIMES_JUDGE));
      SUBMISSIONS_REVEALED.emit(ctx, {
        count: Object.keys(ctx.submissions.values(ABSURDISSIMES_ANSWERS))
          .length,
      });
    } else {
      ctx.turn.to(remainingPlayers[0]);
    }
  },
});

export const judgePick = defineAction<AbsurdissimesState, { winnerId: number }>(
  {
    input: gameInput.object({ winnerId: gameInput.playerId() }),
    available: ({ actor, ctx }) =>
      ABSURDISSIMES_PHASES.is(ctx, 'judge') &&
      actor.id === ctx.judge.current(ABSURDISSIMES_JUDGE),
    validate: ({ input, ctx }) =>
      input.winnerId in ctx.submissions.values(ABSURDISSIMES_ANSWERS),
    enumerate: ({ ctx }) =>
      Object.keys(ctx.submissions.values(ABSURDISSIMES_ANSWERS)).map(
        (playerId) => ({
          winnerId: Number(playerId),
        }),
      ),
    execute: ({ input, ctx }) => {
      const score = ctx.score.add(input.winnerId, 1);
      ctx.events.message('game.round.won', { playerId: input.winnerId });
      completeRound(ctx, {
        winnerPlayerIds: [input.winnerId],
        finishMatch: () => {
          if (score < ABSURDISSIMES_TARGET_SCORE) return false;
          ctx.match.finish({
            winners: [input.winnerId],
            reason: 'target-score',
          });
          return true;
        },
        reset: () => prepareNextRound(ctx),
        next: false,
      });
    },
  },
);

export const ABSURDISSIMES_ACTIONS = {
  play_card: playCard,
  judge_pick: judgePick,
};

export function prepareNextRound(ctx: GameContext<AbsurdissimesState>): void {
  const playerIds = ctx.players.all().map((player) => player.id);
  const { judgePlayerId: nextJudge, participantPlayerIds: remainingPlayers } =
    ctx.submissionFlow.openForJudge({
      submissionId: ABSURDISSIMES_ANSWERS,
      judgeId: ABSURDISSIMES_JUDGE,
      players: playerIds,
      secret: true,
      rotateJudge: true,
    });
  drawWhiteCard(ctx);
  ABSURDISSIMES_PHASES.transition(ctx, 'play');
  ctx.round.start(nextJudge, remainingPlayers);
  ctx.turn.to(remainingPlayers[0] ?? nextJudge);
}

export function drawWhiteCard(
  ctx: GameContext<AbsurdissimesState>,
): string | null {
  const card = ctx.cards.draw<AbsurdissimesCard>(WHITE_DECK);
  if (card != null) ctx.cards.discard(WHITE_DECK, card);
  return card?.text ?? null;
}

export function currentWhiteCard(
  ctx: GameContext<AbsurdissimesState>,
): string | null {
  return (
    ctx.cards.discardPile<AbsurdissimesCard>(WHITE_DECK).at(-1)?.text ?? null
  );
}
