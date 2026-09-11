import {
  cardGame,
  cards,
  defineCardsSchema,
  defineGame,
  movement,
  type NoGameState,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import { CAT_PATTES_PHASES, GAME_CONFIGURATION } from './configuration';
import {
  CAT_PATTES_DECK,
  CAT_PATTES_GAME_CONTENT,
  CAT_PATTES_GOAL,
} from './content';
import { CAT_PATTES_EFFECTS } from './effects';
import manifest from './manifest.json';
import { GAME_RULES } from './rule-bindings';
import { CAT_PATTES_ACTIONS } from './rules';

const cardSchema = defineCardsSchema({
  decks: {
    'cat-pattes': cards.deck({
      id: 'cat-pattes',
      cards: CAT_PATTES_DECK.map((card) => card.id),
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'cat-pattes',
      initial: 6,
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
  content: CAT_PATTES_GAME_CONTENT,
  config: GAME_CONFIGURATION,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'cat-pattes',
      handId: 'players',
    }),
  ],
  components: [
    movement.track({ id: 'cat-pattes', spaces: CAT_PATTES_GOAL + 1 }),
  ],
  shortcuts: [
    { key: 'Space', type: 'action', actionType: 'draw' },
    { key: 'D', type: 'action', actionType: 'discard_card' },
  ],
  initialPhase: CAT_PATTES_PHASES.initialPhase,
  phases: CAT_PATTES_PHASES.phases,
  ...GAME_RULES,
  actions: CAT_PATTES_ACTIONS,
  effects: CAT_PATTES_EFFECTS,
  bot: GAME_BOT,
});
