import {
  cardGame,
  cards,
  defineCardsSchema,
  defineGame,
  inventory,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import { BANDE_A_BANANE_DECK, BANDE_A_BANANE_GAME_CONTENT } from './content';
import manifest from './manifest.json';
import {
  BANDE_A_BANANE_ACTIONS,
  BANDE_A_BANANE_EFFECTS,
  drawAtTurnStart,
} from './rules';
import type { BandeABananeState } from './types';

const cardSchema = defineCardsSchema({
  decks: {
    banana: cards.deck({
      id: 'banana',
      cards: BANDE_A_BANANE_DECK.map((card) => card.id),
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'banana',
      initial: 5,
      visibility: 'owner',
    }),
  },
});

export default defineGame<BandeABananeState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: BANDE_A_BANANE_GAME_CONTENT,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'banana',
      handId: 'players',
      drawAtTurnStart,
    }),
  ],
  components: [inventory.set({ id: 'banana-troops', visibility: 'public' })],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  actions: BANDE_A_BANANE_ACTIONS,
  effects: BANDE_A_BANANE_EFFECTS,
  bot: GAME_BOT,
});
