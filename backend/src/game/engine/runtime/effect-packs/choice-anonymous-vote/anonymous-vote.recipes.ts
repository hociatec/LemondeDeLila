import { defineAction } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import type { AnonymousVoteProgram } from './program';
import type { PlayerMap } from '../../game-identifiers';
import type { GameContext } from '../../definitions/game-author-context';
import { defineEvent } from '../../events/game-event-definition';
import { completeRound } from '../../recipes/gameplay/track-round.recipes';

type AnonymousVoteRoundState = {
  challengeId: string;
  submissions: PlayerMap<number>;
  votes: PlayerMap<number>;
  pointsAwarded: PlayerMap<number>;
  tie: boolean;
};
type RuntimeState = {
  currentChallengeId: string;
  lastRound: AnonymousVoteRoundState | null;
};
type State = Record<string, never>;
type Context = GameContext<State>;

export function anonymousVoteRules(source: AnonymousVoteProgram) {
  const program = structuredClone(source);
  const answersRevealed = defineEvent({
    type: 'choice-anonymous-vote.answers.revealed',
    data: gameInput.object({
      count: gameInput.number({ integer: true, min: 0 }),
    }),
  });
  const roundStarted = defineEvent({
    type: 'choice-anonymous-vote.round.started',
    data: gameInput.object({
      challengeId: gameInput.string({ min: 1, max: 128 }),
    }),
  });
  const choose = defineAction<State, { answerIndex: number }>({
    input: gameInput.object({
      answerIndex: gameInput.number({ integer: true, min: 0, max: 2 }),
    }),
    available: ({ actor, ctx }) =>
      ctx.turn.waitingSession() === program.answerSubmissionId &&
      ctx.turn.waitingPlayers().includes(actor.id),
    validate: ({ input }) => input.answerIndex >= 0 && input.answerIndex <= 2,
    enumerate: () => [0, 1, 2].map((answerIndex) => ({ answerIndex })),
    execute: ({ actor, input, ctx }) => {
      ctx.submissionFlow.submit(
        program.answerSubmissionId,
        actor.id,
        input.answerIndex,
      );
      ctx.events.message('choice-anonymous-vote.answer.submitted', {
        playerId: actor.id,
      });
      if (ctx.submissionFlow.completeWaiting(program.answerSubmissionId)) {
        const submissions = ctx.submissionFlow.revealAndOpenVote<number>({
          submissionId: program.answerSubmissionId,
          voteId: program.voteSubmissionId,
          secret: true,
          waitForAll: true,
        });
        answersRevealed.emit(ctx, {
          count: Object.keys(submissions).length,
        });
      }
    },
  });
  const vote = defineAction<State, { targetPlayerId: number }>({
    input: gameInput.object({ targetPlayerId: gameInput.playerId() }),
    available: ({ actor, ctx }) =>
      ctx.turn.waitingSession() === program.voteSubmissionId &&
      ctx.turn.waitingPlayers().includes(actor.id),
    validate: ({ actor, input, ctx }) =>
      input.targetPlayerId !== actor.id &&
      ctx.submissions.values(program.answerSubmissionId)[
        String(input.targetPlayerId)
      ] != null,
    enumerate: ({ actor, ctx }) =>
      Object.keys(ctx.submissions.values(program.answerSubmissionId))
        .map(Number)
        .filter((playerId) => playerId !== actor.id)
        .map((targetPlayerId) => ({ targetPlayerId })),
    execute: ({ state, actor, input, ctx }) => {
      ctx.submissionFlow.vote(
        program.voteSubmissionId,
        actor.id,
        input.targetPlayerId,
      );
      ctx.events.message('choice-anonymous-vote.vote.submitted', {
        playerId: actor.id,
      });
      if (ctx.submissionFlow.completeWaiting(program.voteSubmissionId))
        resolveRound(program, runtime(state), roundStarted, ctx);
    },
  });
  return {
    choose,
    vote,
    events: [answersRevealed, roundStarted],
    setup: ({ ctx }: { ctx: Context }): State => {
      ctx.submissionFlow.open({
        id: program.answerSubmissionId,
        secret: true,
        waitForAll: true,
      });
      const state: State = {};
      Reflect.set(
        state,
        'currentChallengeId',
        (ctx.random.pick(program.challenges) ?? program.challenges[0]).id,
      );
      Reflect.set(state, 'lastRound', null);
      return state;
    },
    viewExtension: ({ state }: { state: State }) => {
      const current = runtime(state);
      return {
        currentChallengeId: current.currentChallengeId,
        lastRound: current.lastRound
          ? {
              ...current.lastRound,
              submissions: { ...current.lastRound.submissions },
              votes: { ...current.lastRound.votes },
              pointsAwarded: { ...current.lastRound.pointsAwarded },
            }
          : null,
      };
    },
    chooseBot: (actorId: number, ctx: Context) => {
      if (
        ctx.submissionFlow.stage(
          program.answerSubmissionId,
          program.voteSubmissionId,
        ) !== 'voting'
      )
        return {
          recipe: 'choice-anonymous-vote-choose' as const,
          payload: { answerIndex: ctx.random.int(3) },
        };
      const targetPlayerId = ctx.random.pick(
        Object.keys(ctx.submissions.values<number>(program.answerSubmissionId))
          .map(Number)
          .filter((playerId) => playerId !== actorId),
      );
      return targetPlayerId == null
        ? null
        : {
            recipe: 'choice-anonymous-vote-vote' as const,
            payload: { targetPlayerId },
          };
    },
  };
}
function resolveRound(
  program: AnonymousVoteProgram,
  state: RuntimeState,
  roundStarted: ReturnType<typeof defineEvent>,
  ctx: Context,
): void {
  const submissions = ctx.submissions.values<number>(
    program.answerSubmissionId,
  );
  const votes = ctx.submissions.values<number>(program.voteSubmissionId);
  const pointsAwarded: PlayerMap<number> = {};
  for (const result of ctx.voting.tally(program.voteSubmissionId)) {
    const target = gameInput.playerId().parse(result.value);
    ctx.score.add(target, result.votes);
    pointsAwarded[target] = result.votes;
  }
  const qualified = ctx.players
    .all()
    .map((player) => player.id)
    .filter((playerId) => ctx.score.get(playerId) >= program.targetScore);
  const tie = qualified.length > 1;
  state.lastRound = {
    challengeId: state.currentChallengeId,
    submissions: structuredClone(submissions),
    votes: structuredClone(votes),
    pointsAwarded,
    tie,
  };
  const highestRoundScore = Math.max(0, ...Object.values(pointsAwarded));
  const roundWinners = Object.entries(pointsAwarded)
    .filter(([, score]) => score === highestRoundScore)
    .map(([playerId]) => Number(playerId))
    .sort((left, right) => left - right);
  const winnerId = !tie && qualified.length === 1 ? qualified[0] : null;
  const advanced = completeRound(ctx, {
    winnerPlayerIds: roundWinners,
    reset: () => {
      if (winnerId != null) return;
      state.currentChallengeId = (
        ctx.random.pick(
          program.challenges.filter(
            (challenge) => challenge.id !== state.currentChallengeId,
          ),
        ) ?? program.challenges[0]
      ).id;
      ctx.submissionFlow.reset(
        program.answerSubmissionId,
        program.voteSubmissionId,
      );
      ctx.submissionFlow.open({
        id: program.answerSubmissionId,
        secret: true,
        waitForAll: true,
      });
    },
    next: winnerId == null ? 'rotate' : false,
  });
  if (advanced)
    roundStarted.emit(ctx, { challengeId: state.currentChallengeId });
}

function runtime(state: State): RuntimeState {
  if (!isRuntimeState(state))
    throw new TypeError('Invalid AnonymousVote runtime state');
  return state;
}

function isRuntimeState(state: State): state is State & RuntimeState {
  const challengeId = Reflect.get(state, 'currentChallengeId');
  const lastRound = Reflect.get(state, 'lastRound');
  return (
    typeof challengeId === 'string' &&
    (lastRound === null ||
      (typeof lastRound === 'object' && lastRound !== null))
  );
}
