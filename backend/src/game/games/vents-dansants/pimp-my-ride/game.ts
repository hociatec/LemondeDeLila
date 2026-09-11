import {
  cardGame,
  cards,
  defineCardsSchema,
  defineGame,
  inventory,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import { PIMP_MY_RIDE_DECK, PIMP_MY_RIDE_GAME_CONTENT } from './content';
import manifest from './manifest.json';
import { GAME_RULES } from './rule-bindings';
import { PIMP_CAR_NAME_INDEX, PIMP_MY_RIDE_ACTIONS } from './rules';
import { setupGame } from './setup-rules';
import type { PimpMyRideState } from './state';

const cardSchema = defineCardsSchema({
  decks: {
    'car-parts': cards.deck({
      id: 'car-parts',
      cards: PIMP_MY_RIDE_DECK.map((card) => card.id),
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'car-parts',
      initial: 3,
      visibility: 'owner',
    }),
  },
});

export default defineGame<PimpMyRideState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: PIMP_MY_RIDE_GAME_CONTENT,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'car-parts',
      handId: 'players',
    }),
  ],
  components: [
    inventory.set({
      id: 'pimp-my-ride.car-parts',
      items: PIMP_MY_RIDE_DECK.map((card) => card.id),
      visibility: 'public',
    }),
  ],
  initialization: {
    counters: { [PIMP_CAR_NAME_INDEX]: 0 },
    startRound: false,
  },
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'D', type: 'action', actionType: 'discard_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: setupGame,
  actions: PIMP_MY_RIDE_ACTIONS,
  ...GAME_RULES,

  bot: GAME_BOT,
});
