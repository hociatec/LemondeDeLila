import { defineAction } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import { GameCorruptedStateError } from '../../../core/domain/errors/game-runtime.errors';
import type { GameContext } from '../definitions/game-author-context';
import { defineEvent } from '../events/game-event-definition';
import type { PlayerMap } from '../game-identifiers';
import { definePattern } from './gameplay-pattern-core';
import { completeRound, simultaneous } from './pattern-capabilities';

export type AnonymousVoteChallenge = {
  id: string;
  prompt: string;
  answers: readonly string[];
};
export type AnonymousVoteOptions = {
  chooseRecipe: string;
  voteRecipe: string;
  chooseAction: string;
  voteAction: string;
  answerSubmissionId: string;
  voteSubmissionId: string;
  targetScore: number;
  winnerReason: string;
  challenges: readonly AnonymousVoteChallenge[];
  eventNamespace: string;
};

type RoundState = {
  challengeId: string;
  submissions: PlayerMap<number>;
  votes: PlayerMap<number>;
  pointsAwarded: PlayerMap<number>;
  tie: boolean;
};
type RuntimeState = {
  currentChallengeId: string;
  lastRound: RoundState | null;
};
type State = Record<string, never>;
type Context = GameContext<State>;

export function anonymousVote(source: AnonymousVoteOptions) {
  const options = structuredClone(source);
  const answers = (state: State) =>
    options.challenges.find(
      (challenge) => challenge.id === runtime(state).currentChallengeId,
    )?.answers ?? [];
  const revealed = defineEvent({
    type: `${options.eventNamespace}.answers.revealed`,
    data: gameInput.object({
      count: gameInput.number({ integer: true, min: 0 }),
    }),
  });
  const roundStarted = defineEvent({
    type: `${options.eventNamespace}.round.started`,
    data: gameInput.object({
      challengeId: gameInput.string({ min: 1, max: 128 }),
    }),
  });
  return definePattern({
    id: `anonymous-vote:${options.answerSubmissionId}`,
    mechanics: ['simultaneous', 'secret-submissions', 'voting', 'score'],
    turn: simultaneous(),
    events: [revealed, roundStarted],
    victory: {
      evaluate: ({ ctx }) => {
        const reached = ctx.players
          .all()
          .filter((player) => ctx.score.get(player.id) >= options.targetScore);
        return reached.length === 1
          ? { winnerPlayerIds: [reached[0].id], reason: options.winnerReason }
          : null;
      },
    },
    setup: ({ ctx }) => {
      ctx.submissionFlow.open({
        id: options.answerSubmissionId,
        secret: true,
        waitForAll: true,
      });
      const challenge =
        ctx.random.pick(options.challenges) ?? options.challenges[0];
      return {
        currentChallengeId: challenge.id,
        lastRound: null,
      };
    },
    viewExtension: ({ state }) => {
      const current = runtime(state);
      return {
        currentChallengeId: current.currentChallengeId,
        lastRound: current.lastRound
          ? structuredClone(current.lastRound)
          : null,
      };
    },
    actions: {
      [options.chooseRecipe]: defineAction<State, { answerIndex: number }>({
        input: gameInput.object({
          answerIndex: gameInput.number({ integer: true, min: 0, max: 99 }),
        }),
        available: ({ actor, ctx }) =>
          ctx.turn.waitingSession() === options.answerSubmissionId &&
          ctx.turn.waitingPlayers().includes(actor.id),
        validate: ({ input, state }) =>
          input.answerIndex < answers(state).length,
        enumerate: ({ state }) =>
          answers(state).map((_answer, answerIndex) => ({ answerIndex })),
        execute: ({ actor, input, ctx }) => {
          ctx.submissionFlow.submit(
            options.answerSubmissionId,
            actor.id,
            input.answerIndex,
          );
          ctx.events.message(`${options.eventNamespace}.answer.submitted`, {
            playerId: actor.id,
          });
          if (ctx.submissionFlow.completeWaiting(options.answerSubmissionId)) {
            const submissions = ctx.submissionFlow.revealAndOpenVote<number>({
              submissionId: options.answerSubmissionId,
              voteId: options.voteSubmissionId,
              secret: true,
              waitForAll: true,
            });
            revealed.emit(ctx, { count: Object.keys(submissions).length });
          }
        },
      }),
      [options.voteRecipe]: defineAction<State, { targetPlayerId: number }>({
        input: gameInput.object({ targetPlayerId: gameInput.playerId() }),
        available: ({ actor, ctx }) =>
          ctx.turn.waitingSession() === options.voteSubmissionId &&
          ctx.turn.waitingPlayers().includes(actor.id),
        validate: ({ actor, input, ctx }) =>
          input.targetPlayerId !== actor.id &&
          ctx.submissions.values(options.answerSubmissionId)[
            String(input.targetPlayerId)
          ] != null,
        enumerate: ({ actor, ctx }) =>
          Object.keys(ctx.submissions.values(options.answerSubmissionId))
            .map(Number)
            .filter((playerId) => playerId !== actor.id)
            .map((targetPlayerId) => ({ targetPlayerId })),
        execute: ({ state, actor, input, ctx }) => {
          ctx.submissionFlow.vote(
            options.voteSubmissionId,
            actor.id,
            input.targetPlayerId,
          );
          ctx.events.message(`${options.eventNamespace}.vote.submitted`, {
            playerId: actor.id,
          });
          if (ctx.submissionFlow.completeWaiting(options.voteSubmissionId))
            resolveRound(options, runtime(state), roundStarted, ctx);
        },
      }),
    },
    bot: {
      choose: ({ state, actor, ctx, availableActions }) => {
        const voting =
          ctx.submissionFlow.stage(
            options.answerSubmissionId,
            options.voteSubmissionId,
          ) === 'voting';
        if (!voting) {
          if (!availableActions.includes(options.chooseAction)) return null;
          const choices = answers(state);
          return choices.length
            ? {
                type: options.chooseAction,
                payload: { answerIndex: ctx.random.int(choices.length) },
              }
            : null;
        }
        if (!availableActions.includes(options.voteAction)) return null;
        const targetPlayerId = ctx.random.pick(
          Object.keys(
            ctx.submissions.values<number>(options.answerSubmissionId),
          )
            .map(Number)
            .filter((playerId) => playerId !== actor.id),
        );
        return targetPlayerId == null
          ? null
          : { type: options.voteAction, payload: { targetPlayerId } };
      },
    },
  });
}

function resolveRound(
  options: AnonymousVoteOptions,
  state: RuntimeState,
  roundStarted: ReturnType<typeof defineEvent>,
  ctx: Context,
): void {
  const submissions = ctx.submissions.values<number>(
    options.answerSubmissionId,
  );
  const votes = ctx.submissions.values<number>(options.voteSubmissionId);
  const pointsAwarded: PlayerMap<number> = {};
  for (const result of ctx.voting.tally(options.voteSubmissionId)) {
    const target = gameInput.playerId().parse(result.value);
    ctx.score.add(target, result.votes);
    pointsAwarded[target] = result.votes;
  }
  const qualified = ctx.players
    .all()
    .map((player) => player.id)
    .filter((playerId) => ctx.score.get(playerId) >= options.targetScore);
  const tie = qualified.length > 1;
  state.lastRound = {
    challengeId: state.currentChallengeId,
    submissions: structuredClone(submissions),
    votes: structuredClone(votes),
    pointsAwarded,
    tie,
  };
  const highest = Math.max(0, ...Object.values(pointsAwarded));
  const roundWinners = Object.entries(pointsAwarded)
    .filter(([, score]) => score === highest)
    .map(([playerId]) => Number(playerId))
    .sort((left, right) => left - right);
  const winnerId = !tie && qualified.length === 1 ? qualified[0] : null;
  const advanced = completeRound(ctx, {
    winnerPlayerIds: roundWinners,
    reset: () => {
      if (winnerId != null) return;
      const candidates = options.challenges.filter(
        (challenge) => challenge.id !== state.currentChallengeId,
      );
      state.currentChallengeId = (
        ctx.random.pick(candidates) ?? options.challenges[0]
      ).id;
      ctx.submissionFlow.reset(
        options.answerSubmissionId,
        options.voteSubmissionId,
      );
      ctx.submissionFlow.open({
        id: options.answerSubmissionId,
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
  const challengeId = Reflect.get(state, 'currentChallengeId');
  const lastRound = Reflect.get(state, 'lastRound');
  if (
    typeof challengeId !== 'string' ||
    (lastRound !== null &&
      (typeof lastRound !== 'object' || lastRound === null))
  )
    throw new GameCorruptedStateError('Invalid anonymous vote runtime state');
  return state as State & RuntimeState;
}
