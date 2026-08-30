import {
  cards,
  cardGame,
  defineCardsSchema,
  defineGame,
  defineGameContent,
} from '../../../engine/sdk/public-api';
import { LES_MAINS_DECK, LES_MAINS_METIER_CARDS } from './content';
import {
  dealProfessionHands,
  LES_MAINS_ACTIONS,
  LES_MAINS_EFFECTS,
} from './rules';
import type { NoGameState as LesMainsState } from '../../../engine/sdk/public-api';

const familySets = cards.sets({
  id: 'profession-families',
  hand: 'players',
  deck: 'professions',
  visibility: 'public',
  sets: LES_MAINS_METIER_CARDS.reduce<Record<string, string[]>>(
    (sets, card) => {
      if (card.family) (sets[card.family] ??= []).push(card.id);
      return sets;
    },
    {},
  ),
});
const cardSchema = defineCardsSchema({
  decks: {
    professions: cards.deck({
      id: 'professions',
      cards: LES_MAINS_DECK.map((card) => card.id),
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'professions',
      initial: 0,
      visibility: 'owner',
    }),
  },
});

export default defineGame<LesMainsState>()({
  id: 'les-mains-de-la-terre',
  displayName: 'Les Mains de la Terre',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Complétez les sept familles de métiers du monde.',
  players: { min: 2, max: 6 },
  content: defineGameContent('les-mains-de-la-terre', {
    cards: LES_MAINS_DECK,
  }),
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'professions',
      handId: 'players',
    }),
  ],
  components: [familySets],
  shortcuts: [{ key: 'D', type: 'action', actionType: 'request_card' }],
  setup: ({ players, ctx }) => {
    dealProfessionHands(
      players.map((player) => player.id),
      ctx,
    );
    return {};
  },
  actions: LES_MAINS_ACTIONS,
  effects: LES_MAINS_EFFECTS,
  bot: {
    choose: ({ state, actor, ctx }) => {
      const first = LES_MAINS_ACTIONS.request_card.enumerate?.({
        state,
        actor,
        ctx,
      })[0];
      return first ? { type: 'request_card', payload: first } : null;
    },
  },
});
