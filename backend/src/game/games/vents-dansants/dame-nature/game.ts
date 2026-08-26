import {
  cards,
  clockwise,
  defineGame,
  playerView,
  victoryWhen,
} from '../../../core/application/public-api';
import {
  DAME_NATURE_CARD_BY_ID,
  DAME_NATURE_FAMILY_CARD_IDS,
  DAME_NATURE_NATURE_CARD_IDS,
  DAME_NATURE_QUIZ_CARD_IDS,
} from './content';
import { completedFamilyCount, DAME_NATURE_ACTIONS } from './rules';
import type { DameNaturePlayerView, DameNatureState } from './state';

const deck = cards.deck({
  id: 'nature',
  cards: DAME_NATURE_FAMILY_CARD_IDS,
  shuffle: true,
});
const hands = cards.hands({
  id: 'players',
  deck: 'nature',
  initial: 5,
  visibility: 'owner',
});

export default defineGame<
  DameNatureState,
  typeof DAME_NATURE_ACTIONS,
  DameNaturePlayerView
>({
  id: 'dame-nature',
  displayName: 'Dame Nature',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Réunissez quatre familles avant le pic de pollution.',
  players: { min: 2, max: 6 },
  components: [deck, hands],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'ask_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: ({ ctx }) => {
    ctx.cards.putOnTop('nature', [
      ...DAME_NATURE_QUIZ_CARD_IDS,
      ...DAME_NATURE_NATURE_CARD_IDS,
    ]);
    ctx.cards.shuffle('nature');
    return {
      pollutionTokens: 0,
      pollutionLoserId: null,
      lastQuizCardId: null,
      winnerIds: [],
    };
  },
  turn: clockwise(),
  actions: DAME_NATURE_ACTIONS,
  victory: victoryWhen(({ state }) =>
    state.winnerIds.length === 0
      ? null
      : { winnerPlayerIds: state.winnerIds, reason: 'nature-completed' },
  ),
  view: ({ state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<string>('players', actor.id) : [];
    const completedFamilies = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [player.id, completedFamilyCount(player.id, ctx)]),
    );
    return playerView({
      game: {
        ...structuredClone(state),
        hand: structuredClone(hand),
        handCounts: ctx.cards.handCounts('players'),
        deckCount: ctx.cards.deckCount('nature'),
        discardCount: ctx.cards.discardCount('nature'),
        completedFamilies,
      },
      extras: {
        hand: hand.map((cardId) => DAME_NATURE_CARD_BY_ID[cardId]),
        handCounts: ctx.cards.handCounts('players'),
        completedFamilies,
        pollutionTokens: state.pollutionTokens,
      },
    });
  },
  bot: {
    choose: ({ actor, ctx }) => {
      const target = ctx.players.all().find((player) => player.id !== actor.id);
      const cardId =
        DAME_NATURE_FAMILY_CARD_IDS[
          ctx.random.int(DAME_NATURE_FAMILY_CARD_IDS.length)
        ];
      return target
        ? { type: 'ask_card', payload: { targetPlayerId: target.id, cardId } }
        : { type: 'pass', payload: {} };
    },
  },
});
