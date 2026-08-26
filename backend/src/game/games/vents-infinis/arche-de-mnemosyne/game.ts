import {
  defineGame,
  playerView,
  quiz,
  simultaneous,
  victoryWhen,
} from '../../../core/application/public-api';
import { MNEMO_BANKS, MNEMO_CATEGORIES } from './content';
import { MNEMO_ACTIONS } from './rules';
import type { MnemoPlayerView, MnemoState } from './state';

export default defineGame<MnemoState, typeof MNEMO_ACTIONS, MnemoPlayerView>({
  id: 'arche-de-mnemosyne',
  displayName: "L'Arche de Mnémosyne",
  category: 'Quiz',
  subcategory: 'VentsInfinis',
  description: 'Quiz simultané par catégories aux réponses mélangées.',
  players: { min: 1, max: 8 },
  components: MNEMO_BANKS.map((bank) =>
    quiz.bank({ id: bank.id, questions: bank.questions, shuffle: true }),
  ),
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'draw' }],
  setup: ({ players }) => ({
    ownerId: players.find((player) => !player.isBot)?.id ?? players[0].id,
    config: {
      targetPoints: 20,
      useTimer: true,
      timerSeconds: 30,
      interQuestionSeconds: 15,
      correctSoloPoints: 2,
      correctMultiPoints: 1,
      wrongPoints: 0,
      timeoutPoints: -1,
    },
    categoryId: null,
    scores: Object.fromEntries(players.map((player) => [player.id, 0])),
    currentQuestion: null,
    correctnessByPlayerId: {},
    answeredPlayerIds: [],
    deadlineMs: null,
    notBeforeMs: null,
    roundNumber: 1,
    questionLeaderId: players[0].id,
    winnerId: null,
  }),
  initialPhase: 'setup',
  turn: simultaneous(),
  actions: MNEMO_ACTIONS,
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'target-score' },
  ),
  view: ({ state, ctx }) => {
    const {
      correctnessByPlayerId: _correctness,
      deadlineMs,
      ...publicState
    } = state;
    return playerView({
      game: {
        ...structuredClone(publicState),
        currentQuestion: state.currentQuestion
          ? structuredClone(state.currentQuestion)
          : null,
        remainingMilliseconds:
          deadlineMs == null
            ? null
            : Math.max(0, deadlineMs - ctx.clock.nowMs()),
        categories: structuredClone(MNEMO_CATEGORIES),
      },
      extras: { scores: structuredClone(state.scores) },
    });
  },
  bot: {
    choose: ({ state, actor, availableActions, ctx }) => {
      if (availableActions.includes('answer'))
        return { type: 'answer', payload: { answerIndex: ctx.random.int(4) } };
      if (availableActions.includes('draw'))
        return { type: 'draw', payload: {} };
      if (availableActions.includes('selectCategory'))
        return { type: 'selectCategory', payload: { categoryId: 'all' } };
      if (availableActions.includes('timeout'))
        return { type: 'timeout', payload: {} };
      if (actor.id === state.ownerId && availableActions.includes('configure'))
        return { type: 'configure', payload: { ...state.config } };
      return null;
    },
  },
});
