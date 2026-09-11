import {
  cardGame,
  cards,
  defineCardsSchema,
  defineGame,
} from '../../../engine/sdk/public-api';
import { ZIG_ET_ZAG_DECK, ZIG_ET_ZAG_GAME_CONTENT } from './content';
import manifest from './manifest.json';
import { GAME_RULES } from './rule-bindings';
import { ZIG_ET_ZAG_ACTIONS, ZIG_ET_ZAG_PHASES } from './rules';
import { setupGame } from './setup-rules';
import type { ZigEtZagState } from './state';

const INITIAL_HAND_SIZE = ZIG_ET_ZAG_DECK.length / 2;
const cardSchema = defineCardsSchema({
  decks: {
    battle: cards.deck({
      id: 'battle',
      cards: ZIG_ET_ZAG_DECK.map((card) => card.id),
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'battle',
      initial: INITIAL_HAND_SIZE,
      visibility: 'owner',
    }),
  },
});

export default defineGame<ZigEtZagState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: ZIG_ET_ZAG_GAME_CONTENT,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'battle',
      handId: 'players',
    }),
  ],
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'draw_card' }],
  initialization: { firstPlayer: 'first', startRound: true },
  setup: setupGame,
  initialPhase: ZIG_ET_ZAG_PHASES.initialPhase,
  phases: ZIG_ET_ZAG_PHASES.phases,
  actions: ZIG_ET_ZAG_ACTIONS,
  ...GAME_RULES,
  bot: { choose: () => ({ type: 'draw_card', payload: {} }) },
});
