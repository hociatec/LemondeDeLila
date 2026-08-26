import {
  cards,
  clockwise,
  defineGame,
  playerView,
  victoryWhen,
} from '../../../core/application/public-api';
import { ENTRE_RITES_CARD_BY_ID, ENTRE_RITES_DECK } from './content';
import {
  dealFamilyHands,
  ENTRE_RITES_ACTIONS,
  enumerateRequests,
  resolveRitesChoice,
} from './rules';
import type { EntreRitesPlayerView, EntreRitesState } from './state';

const deck = cards.deck({
  id: 'rites',
  cards: ENTRE_RITES_DECK.map((card) => card.id),
  shuffle: true,
});
const hands = cards.hands({
  id: 'players',
  deck: 'rites',
  initial: 0,
  visibility: 'owner',
});

export default defineGame<
  EntreRitesState,
  typeof ENTRE_RITES_ACTIONS,
  EntreRitesPlayerView
>({
  id: 'entre-rites-et-lumieres',
  displayName: 'Entre Rites & Lumières !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Rassemblez les cinq familles pascales.',
  players: { min: 2, max: 6 },
  components: [deck, hands],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'ask_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: ({ players, ctx }) => {
    dealFamilyHands(
      players.map((player) => player.id),
      ctx,
    );
    return {
      completedFamilies: Object.fromEntries(
        players.map((player) => [player.id, []]),
      ),
      specialsPlayed: Object.fromEntries(
        players.map((player) => [player.id, []]),
      ),
      peaceTurnsRemaining: 0,
      silenceOwnerId: null,
      pendingChoice: null,
      winnerId: null,
    };
  },
  turn: clockwise(),
  actions: ENTRE_RITES_ACTIONS,
  choices: {
    'rites.special': {
      resolve: ({ state, value, ctx }) => resolveRitesChoice(state, value, ctx),
    },
  },
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'five-families' },
  ),
  view: ({ state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<string>('players', actor.id) : [];
    const { pendingChoice: _pendingChoice, ...publicGame } = state;
    return playerView({
      game: {
        ...structuredClone(publicGame),
        hand: structuredClone(hand),
        handCounts: ctx.cards.handCounts('players'),
        deckCount: ctx.cards.deckCount('rites'),
        discardCount: ctx.cards.discardCount('rites'),
      },
      extras: {
        hand: hand.map((cardId) => ENTRE_RITES_CARD_BY_ID[cardId]),
        handCounts: ctx.cards.handCounts('players'),
        completedFamilies: structuredClone(state.completedFamilies),
        specialsPlayedCount: Object.fromEntries(
          Object.entries(state.specialsPlayed).map(([playerId, cards]) => [
            playerId,
            cards.length,
          ]),
        ),
      },
    });
  },
  bot: {
    choose: ({ state, actor, ctx }) => {
      const request =
        state.peaceTurnsRemaining === 0
          ? enumerateRequests(actor.id, ctx)[0]
          : null;
      return request
        ? { type: 'ask_card', payload: request }
        : { type: 'pass', payload: {} };
    },
  },
});
