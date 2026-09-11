import type { NoGameState as AbsurdissimesState } from '../../../engine/sdk/public-api';
import {
  cardGame,
  cards,
  defineCardsSchema,
  defineGame,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import {
  ABSURDISSIMES_GAME_CONTENT,
  BLACK_CARDS,
  WHITE_CARDS,
} from './content';
import manifest from './manifest.json';
import {
  ABSURDISSIMES_ACTIONS,
  ABSURDISSIMES_PHASES,
  SUBMISSIONS_REVEALED,
} from './rules';
import { setupGame } from './setup-rules';

const cardSchema = defineCardsSchema({
  decks: {
    white: cards.deck({ id: 'white', cards: WHITE_CARDS, shuffle: true }),
    black: cards.deck({
      id: 'black',
      cards: BLACK_CARDS,
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    answers: cards.hands({
      id: 'answers',
      deck: 'black',
      initial: 10,
      visibility: 'owner',
    }),
  },
});
export default defineGame<AbsurdissimesState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'Cartes',
  subcategory: 'VentsDansants',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  events: [SUBMISSIONS_REVEALED],
  content: ABSURDISSIMES_GAME_CONTENT,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'black',
      handId: 'answers',
    }),
  ],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'J', type: 'action', actionType: 'judge_pick' },
  ],
  setup: setupGame,
  initialPhase: ABSURDISSIMES_PHASES.initialPhase,
  phases: ABSURDISSIMES_PHASES.phases,
  actions: ABSURDISSIMES_ACTIONS,
  bot: GAME_BOT,
});
