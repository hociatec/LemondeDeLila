import {
  defineGame,
  playerView,
  simultaneous,
  victoryWhen,
} from '../../../core/application/public-api';
import { NAWAK_CHALLENGES } from './content';
import { NAWAK_ACTIONS } from './rules';
import type { NawakPlayerView, NawakState } from './state';

export default defineGame<NawakState, typeof NAWAK_ACTIONS, NawakPlayerView>({
  id: 'nawak',
  displayName: 'Nawak !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description:
    'Répondez aux défis absurdes puis votez pour une réponse étrangère.',
  players: { min: 2, max: 8 },
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'choose_answer' },
    { key: 'V', type: 'action', actionType: 'vote_answer' },
  ],
  setup: ({ players, ctx }) => ({
    targetScore: 5,
    scores: Object.fromEntries(players.map((player) => [player.id, 0])),
    currentChallenge: ctx.random.pick(NAWAK_CHALLENGES) ?? NAWAK_CHALLENGES[0],
    roundStage: 'choose',
    submissions: {},
    votes: {},
    lastRound: null,
    winnerId: null,
  }),
  turn: simultaneous(),
  actions: NAWAK_ACTIONS,
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'target-score' },
  ),
  view: ({ state }) => {
    const revealAnswers = state.roundStage === 'vote';
    return playerView({
      game: {
        ...structuredClone(state),
        submissions: revealAnswers ? structuredClone(state.submissions) : {},
        votes: {},
      },
      extras: {
        hand: [...state.currentChallenge.answers],
        targetScore: state.targetScore,
        scores: structuredClone(state.scores),
        stage: state.roundStage,
        challenge: structuredClone(state.currentChallenge),
        submissions: revealAnswers ? structuredClone(state.submissions) : {},
        submissionCount: Object.keys(state.submissions).length,
        voteCount: Object.keys(state.votes).length,
        lastRound: structuredClone(state.lastRound),
      },
    });
  },
  bot: {
    choose: ({ state, actor, ctx }) => {
      if (state.roundStage === 'choose') {
        return {
          type: 'choose_answer',
          payload: { answerIndex: ctx.random.int(3) },
        };
      }
      const targets = Object.keys(state.submissions)
        .map(Number)
        .filter((playerId) => playerId !== actor.id);
      const targetPlayerId = ctx.random.pick(targets);
      return targetPlayerId == null
        ? null
        : { type: 'vote_answer', payload: { targetPlayerId } };
    },
  },
});
