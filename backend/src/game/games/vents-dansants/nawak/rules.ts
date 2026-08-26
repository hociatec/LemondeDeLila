import {
  defineAction,
  defineEvent,
  gameInput,
} from '../../../core/application/public-api';
import type {
  GameContext,
  PlayerMap,
} from '../../../core/application/public-api';
import { NAWAK_CHALLENGES } from './content';
import type { NawakRoundState, NawakStage, NawakState } from './state';

const ANSWERS = 'nawak.answers';
const VOTES = 'nawak.votes';
type RuleContext = GameContext<NawakState>;
export const NAWAK_TARGET_SCORE = 5;
const ANSWERS_REVEALED = defineEvent({
  type: 'nawak.answers.revealed',
  data: gameInput.object({ count: gameInput.number({ integer: true, min: 0 }) }),
});
const ROUND_STARTED = defineEvent({
  type: 'nawak.round.started',
  data: gameInput.object({
    challengeId: gameInput.string({ min: 1, max: 128 }),
  }),
});

export const chooseAnswer = defineAction<NawakState, { answerIndex: number }>({
  input: gameInput.object({
    answerIndex: gameInput.number({ integer: true, min: 0, max: 2 }),
  }),
  available: ({ actor, ctx }) =>
    ctx.turn.waitingSession() === ANSWERS &&
    ctx.turn.waitingPlayers().includes(actor.id),
  validate: ({ input }) => input.answerIndex >= 0 && input.answerIndex <= 2,
  enumerate: () => [0, 1, 2].map((answerIndex) => ({ answerIndex })),
  execute: ({ state, actor, input, ctx }) => {
    ctx.submissions.submit(ANSWERS, actor.id, input.answerIndex);
    ctx.events.message('nawak.answer.submitted', { playerId: actor.id });
    if (ctx.turn.completeWaiting(ANSWERS)) {
      const submissions = ctx.submissions.reveal<number>(ANSWERS);
      ctx.voting.open({
        id: VOTES,
        choices: Object.keys(submissions).map(Number),
        secret: true,
      });
      ctx.turn.waitForAll(VOTES);
      ANSWERS_REVEALED.emit(ctx, {
        count: Object.keys(submissions).length,
      });
    }
  },
});

export const voteAnswer = defineAction<NawakState, { targetPlayerId: number }>({
  input: gameInput.object({ targetPlayerId: gameInput.playerId() }),
  available: ({ actor, ctx }) =>
    ctx.turn.waitingSession() === VOTES &&
    ctx.turn.waitingPlayers().includes(actor.id),
  validate: ({ actor, input, ctx }) =>
    input.targetPlayerId !== actor.id &&
    ctx.submissions.values(ANSWERS)[String(input.targetPlayerId)] != null,
  enumerate: ({ actor, ctx }) =>
    Object.keys(ctx.submissions.values(ANSWERS))
      .map(Number)
      .filter((playerId) => playerId !== actor.id)
      .map((targetPlayerId) => ({ targetPlayerId })),
  execute: ({ state, actor, input, ctx }) => {
    ctx.voting.vote(VOTES, actor.id, input.targetPlayerId);
    ctx.events.message('nawak.vote.submitted', { playerId: actor.id });
    if (ctx.turn.completeWaiting(VOTES)) {
      finishRound(state, ctx);
    }
  },
});

export const NAWAK_ACTIONS = {
  choose_answer: chooseAnswer,
  vote_answer: voteAnswer,
};

export function nawakStage(ctx: RuleContext): NawakStage {
  return ctx.turn.waitingSession() === VOTES ? 'vote' : 'choose';
}

function finishRound(
  state: NawakState,
  ctx: RuleContext,
): void {
  const submissions = ctx.submissions.values<number>(ANSWERS);
  const votes = ctx.submissions.values<number>(VOTES);
  const pointsAwarded: PlayerMap<number> = {};
  for (const target of Object.values(votes)) {
    ctx.score.add(target, 1);
    pointsAwarded[target] = (pointsAwarded[target] ?? 0) + 1;
  }
  const qualified = ctx.players
    .all()
    .map((player) => player.id)
    .filter((playerId) => ctx.score.get(playerId) >= NAWAK_TARGET_SCORE);
  const tie = qualified.length > 1;
  const summary: NawakRoundState = {
    challengeId: state.currentChallengeId,
    submissions: structuredClone(submissions),
    votes: structuredClone(votes),
    pointsAwarded,
    tie,
  };
  state.lastRound = summary;
  const highestRoundScore = Math.max(0, ...Object.values(pointsAwarded));
  const roundWinners = Object.entries(pointsAwarded)
    .filter(([, score]) => score === highestRoundScore)
    .map(([playerId]) => Number(playerId));
  ctx.round.end(roundWinners);
  const winnerId = !tie && qualified.length === 1 ? qualified[0] : null;
  if (winnerId != null) {
    ctx.match.finish({ winners: [winnerId], reason: 'target-score' });
    return;
  }
  state.currentChallengeId = (
    ctx.random.pick(
      NAWAK_CHALLENGES.filter(
        (challenge) => challenge.id !== state.currentChallengeId,
      ),
    ) ?? NAWAK_CHALLENGES[0]
  ).id;
  ctx.submissions.clear(ANSWERS);
  ctx.submissions.clear(VOTES);
  ctx.submissions.open({ id: ANSWERS, secret: true });
  ctx.turn.waitForAll(ANSWERS);
  ctx.round.next();
  ROUND_STARTED.emit(ctx, {
    challengeId: state.currentChallengeId,
  });
}
