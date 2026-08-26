import { defineAction, gameInput } from '../../../core/application/public-api';
import { NAWAK_CHALLENGES } from './content';
import type { NawakRoundSummary, NawakState } from './state';

export const chooseAnswer = defineAction<NawakState, { answerIndex: number }>({
  input: gameInput.object({
    answerIndex: gameInput.number({ integer: true, min: 0, max: 2 }),
  }),
  available: ({ state, actor }) =>
    state.roundStage === 'choose' && state.submissions[actor.id] == null,
  availableInputs: () => [0, 1, 2].map((answerIndex) => ({ answerIndex })),
  execute: ({ state, actor, input, ctx }) => {
    state.submissions[actor.id] = input.answerIndex;
    ctx.history.add(`${actor.username} a choisi sa réponse.`);
    if (
      ctx.players.all().every((player) => state.submissions[player.id] != null)
    ) {
      state.roundStage = 'vote';
      state.votes = {};
      ctx.events.emit('nawak.answers.revealed', {
        count: Object.keys(state.submissions).length,
      });
    }
  },
});

export const voteAnswer = defineAction<NawakState, { targetPlayerId: number }>({
  input: gameInput.object({ targetPlayerId: gameInput.playerId() }),
  available: ({ state, actor }) =>
    state.roundStage === 'vote' && state.votes[actor.id] == null,
  availableInputs: ({ state, actor }) =>
    Object.keys(state.submissions)
      .map(Number)
      .filter((playerId) => playerId !== actor.id)
      .map((targetPlayerId) => ({ targetPlayerId })),
  execute: ({ state, actor, input, ctx }) => {
    state.votes[actor.id] = input.targetPlayerId;
    ctx.history.add(`${actor.username} a voté.`);
    if (ctx.players.all().every((player) => state.votes[player.id] != null)) {
      finishRound(state, ctx);
    }
  },
});

export const NAWAK_ACTIONS = {
  choose_answer: chooseAnswer,
  vote_answer: voteAnswer,
};

function finishRound(
  state: NawakState,
  ctx: {
    random: { pick<T>(values: readonly T[]): T | null };
    players: { all(): Array<{ id: number }> };
    events: { emit(type: string, data: Record<string, unknown>): void };
  },
): void {
  const pointsAwarded: Record<number, number> = {};
  for (const target of Object.values(state.votes)) {
    state.scores[target] = (state.scores[target] ?? 0) + 1;
    pointsAwarded[target] = (pointsAwarded[target] ?? 0) + 1;
  }
  const qualified = ctx.players
    .all()
    .map((player) => player.id)
    .filter((playerId) => (state.scores[playerId] ?? 0) >= state.targetScore);
  const tie = qualified.length > 1;
  const summary: NawakRoundSummary = {
    challengeId: state.currentChallenge.id,
    prompt: state.currentChallenge.prompt,
    submissions: structuredClone(state.submissions),
    votes: structuredClone(state.votes),
    pointsAwarded,
    tie,
  };
  state.lastRound = summary;
  state.winnerId = !tie && qualified.length === 1 ? qualified[0] : null;
  if (state.winnerId != null) return;
  state.currentChallenge =
    ctx.random.pick(
      NAWAK_CHALLENGES.filter(
        (challenge) => challenge.id !== state.currentChallenge.id,
      ),
    ) ?? NAWAK_CHALLENGES[0];
  state.roundStage = 'choose';
  state.submissions = {};
  state.votes = {};
  ctx.events.emit('nawak.round.started', {
    challengeId: state.currentChallenge.id,
  });
}
