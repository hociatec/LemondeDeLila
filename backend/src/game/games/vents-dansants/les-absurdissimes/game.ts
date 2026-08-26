import {
  cards,
  defineGame,
  playerView,
  standardTurn,
  victoryWhen,
} from '../../../core/application/public-api';
import { BLACK_CARDS, WHITE_CARDS } from './content';
import { ABSURDISSIMES_ACTIONS, judgeId } from './rules';
import type { AbsurdissimesPlayerView, AbsurdissimesState } from './state';

const whiteDeck = cards.deck({
  id: 'white',
  cards: WHITE_CARDS,
  shuffle: true,
});
const blackDeck = cards.deck({
  id: 'black',
  cards: BLACK_CARDS,
  shuffle: true,
});
const hands = cards.hands({
  id: 'answers',
  deck: 'black',
  initial: 10,
  visibility: 'owner',
});

export default defineGame<
  AbsurdissimesState,
  typeof ABSURDISSIMES_ACTIONS,
  AbsurdissimesPlayerView
>({
  id: 'les-absurdissimes',
  displayName: 'Les Absurdissimes !',
  category: 'Cartes',
  subcategory: 'VentsDansants',
  description: 'Proposez la réponse la plus absurde et convainquez le juge.',
  players: { min: 3, max: 8 },
  components: [whiteDeck, blackDeck, hands],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'J', type: 'action', actionType: 'judge_pick' },
  ],
  setup: ({ players, ctx }) => {
    const playerIds = players.map((player) => player.id);
    const judge = playerIds[0] ?? 0;
    const remainingPlayers = playerIds.filter((playerId) => playerId !== judge);
    ctx.turn.to(remainingPlayers[0] ?? judge);
    return {
      currentWhite: ctx.cards.draw<string>('white'),
      judgeIndex: 0,
      roundStage: 'play',
      submissions: {},
      scores: Object.fromEntries(playerIds.map((playerId) => [playerId, 0])),
      targetScore: 10,
      remainingPlayers,
      winnerId: null,
    };
  },
  turn: standardTurn(),
  actions: ABSURDISSIMES_ACTIONS,
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'target-score' },
  ),
  view: ({ state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<string>('answers', actor.id) : [];
    const handCounts = ctx.cards.handCounts('answers');
    const revealSubmissions = state.roundStage === 'judge';
    const judge = judgeId(
      state,
      ctx.players.all().map((player) => player.id),
    );
    return playerView({
      game: {
        ...structuredClone(state),
        submissions: revealSubmissions
          ? structuredClone(state.submissions)
          : {},
        hand: structuredClone(hand),
        handCounts,
        submissionCount: Object.keys(state.submissions).length,
      },
      extras: {
        stage: state.roundStage,
        currentWhite: state.currentWhite,
        judgeId: judge,
        hand: structuredClone(hand),
        handCounts,
        remainingPlayers: [...state.remainingPlayers],
        scores: structuredClone(state.scores),
        targetScore: state.targetScore,
        submissions: revealSubmissions
          ? structuredClone(state.submissions)
          : {},
        submissionCount: Object.keys(state.submissions).length,
      },
    });
  },
  bot: {
    choose: ({ state, actor, ctx }) => {
      if (state.roundStage === 'judge') {
        const winnerId = ctx.random.pick(
          Object.keys(state.submissions).map(Number),
        );
        return winnerId == null
          ? null
          : { type: 'judge_pick', payload: { winnerId } };
      }
      const cardId = ctx.random.pick(
        ctx.cards.hand<string>('answers', actor.id),
      );
      return cardId == null ? null : { type: 'play_card', payload: { cardId } };
    },
  },
});
