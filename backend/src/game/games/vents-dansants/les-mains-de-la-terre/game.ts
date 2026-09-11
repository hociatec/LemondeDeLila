import type { NoGameState as LesMainsState } from '../../../engine/sdk/public-api';
import {
  cardGame,
  cards,
  defineCardsSchema,
  defineGame,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import {
  LES_MAINS_DECK,
  LES_MAINS_GAME_CONTENT,
  LES_MAINS_METIER_CARDS,
} from './content';
import manifest from './manifest.json';
import { LES_MAINS_ACTIONS, LES_MAINS_EFFECTS } from './rules';
import { setupGame } from './setup-rules';

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
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: LES_MAINS_GAME_CONTENT,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'professions',
      handId: 'players',
    }),
  ],
  components: [familySets],
  resourceIds: ['les-mains.extra-draws'],
  shortcuts: [{ key: 'D', type: 'action', actionType: 'request_card' }],
  setup: setupGame,
  actions: LES_MAINS_ACTIONS,
  effects: LES_MAINS_EFFECTS,
  bot: GAME_BOT,
});
