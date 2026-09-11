import {
  cardGame,
  cards,
  defineCardsSchema,
  defineGame,
  type NoGameState,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import {
  DAME_NATURE_FAMILY_CARD_DEFINITIONS,
  DAME_NATURE_FAMILY_CARD_IDS,
  DAME_NATURE_GAME_CONTENT,
} from './content';
import manifest from './manifest.json';
import { DAME_NATURE_ACTIONS, DAME_NATURE_POLLUTION } from './rules';
import { setupGame } from './setup-rules';

const familySets = cards.sets({
  id: 'nature-families',
  hand: 'players',
  deck: 'nature',
  visibility: 'public',
  sets: DAME_NATURE_FAMILY_CARD_DEFINITIONS.reduce<Record<string, string[]>>(
    (sets, card) => {
      (sets[card.familyId] ??= []).push(card.id);
      return sets;
    },
    {},
  ),
});
const cardSchema = defineCardsSchema({
  decks: {
    nature: cards.deck({
      id: 'nature',
      cards: DAME_NATURE_FAMILY_CARD_IDS,
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'nature',
      initial: 5,
      visibility: 'owner',
    }),
  },
});

export default defineGame<NoGameState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: DAME_NATURE_GAME_CONTENT,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'nature',
      handId: 'players',
    }),
  ],
  components: [familySets],
  initialization: {
    counters: { [DAME_NATURE_POLLUTION]: 0 },
    startRound: false,
  },
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'ask_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: setupGame,
  actions: DAME_NATURE_ACTIONS,
  bot: GAME_BOT,
});
