import {
  cardGame,
  cards,
  defineCardsSchema,
  defineGame,
  inventory,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import { CERCLES_SACRES_DECK, CERCLES_SACRES_GAME_CONTENT } from './content';
import manifest from './manifest.json';
import { CERCLES_SACRES_ACTIONS, drawAtTurnStart } from './rules';
import type { CerclesSacresState } from './types';

const cardSchema = defineCardsSchema({
  decks: {
    'sacred-circles': cards.deck({
      id: 'sacred-circles',
      cards: CERCLES_SACRES_DECK.map((card) => card.id),
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'sacred-circles',
      initial: 6,
      visibility: 'owner',
    }),
  },
});

export default defineGame<CerclesSacresState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: CERCLES_SACRES_GAME_CONTENT,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'sacred-circles',
      handId: 'players',
      drawAtTurnStart,
    }),
  ],
  components: [
    inventory.set({ id: 'sacred-circles-completed', visibility: 'public' }),
  ],
  shortcuts: [
    { key: 'F', type: 'action', actionType: 'form_circle' },
    { key: 'D', type: 'action', actionType: 'discard_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  actions: CERCLES_SACRES_ACTIONS,
  bot: GAME_BOT,
});
