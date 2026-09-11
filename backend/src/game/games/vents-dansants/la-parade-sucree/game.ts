import {
  cardGame,
  cards,
  defineCardsSchema,
  defineGame,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import { PARADE_CARDS, PARADE_GAME_CONTENT } from './content';
import manifest from './manifest.json';
import { GAME_VICTORY } from './rules';

import { PARADE_ACTIONS } from './rules';
import type { LaParadeSucreeState } from './types';

const cardSchema = defineCardsSchema({
  decks: {
    parade: cards.deck({
      id: 'parade',
      cards: PARADE_CARDS.map((card) => card.id),
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'parade',
      initial: PARADE_CARDS.length,
      visibility: 'owner',
    }),
  },
});

export default defineGame<LaParadeSucreeState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: PARADE_GAME_CONTENT,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'parade',
      handId: 'players',
    }),
  ],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  actions: PARADE_ACTIONS,
  victory: GAME_VICTORY,
  bot: GAME_BOT,
});
