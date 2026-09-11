import {
  cardGame,
  cards,
  defineCardsSchema,
  defineGame,
  inventory,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import { LA_GRANDE_MINE_CARDS, LA_GRANDE_MINE_GAME_CONTENT } from './content';
import { GRANDE_MINE_EFFECTS } from './effects';
import manifest from './manifest.json';
import { drawAtTurnStart, GRANDE_MINE_ACTIONS, MINE_DOMAINS } from './rules';
import type { GrandeMineState } from './types';

const cardSchema = defineCardsSchema({
  decks: {
    mine: cards.deck({
      id: 'mine',
      cards: LA_GRANDE_MINE_CARDS.map((card) => card.id),
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'mine',
      initial: 5,
      visibility: 'owner',
    }),
  },
});

export default defineGame<GrandeMineState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: LA_GRANDE_MINE_GAME_CONTENT,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'mine',
      handId: 'players',
      drawAtTurnStart: ({ ctx }) => drawAtTurnStart(ctx),
    }),
  ],
  components: [inventory.set({ id: MINE_DOMAINS, visibility: 'public' })],
  initialization: { scores: 0 },
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  actions: GRANDE_MINE_ACTIONS,
  effects: GRANDE_MINE_EFFECTS,
  bot: GAME_BOT,
});
