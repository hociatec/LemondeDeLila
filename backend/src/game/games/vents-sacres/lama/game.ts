import {
  cardGame,
  cards,
  defineCardsSchema,
  defineGame,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import { LAMA_CONFIGURATION } from './configuration';
import { LAMA_GAME_CONTENT, LAMA_MAX_DECK } from './content';
import manifest from './manifest.json';
import { GAME_RULES, LamaState } from './rule-bindings';
import { LAMA_ACTIONS, LAMA_PHASES } from './rules';

const cardSchema = defineCardsSchema({
  decks: {
    lama: cards.deck({
      id: 'lama',
      cards: LAMA_MAX_DECK,
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    'lama-hands': cards.hands({
      id: 'lama-hands',
      deck: 'lama',
      initial: 0,
      visibility: 'owner',
      ownerVisibility: 'active-round',
    }),
  },
});

export default defineGame<LamaState>()({
  id: manifest.code,
  rulesVersion: '2',
  displayName: manifest.name,
  category: 'JeuxDeCartes',
  subcategory: 'VentsSacres',
  description: manifest.summary,
  content: LAMA_GAME_CONTENT,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  presentation: {
    score: {
      label: 'Jetons',
      unit: { singular: 'jeton', plural: 'jetons' },
      changeNarration: 'delta-and-total',
      visibility: 'active-match',
    },
  },
  shortcuts: [
    { key: 'Space', type: 'action', actionType: 'draw', label: 'Piocher' },
    { key: 'S', type: 'interface', id: 'score', label: 'Jetons' },
    {
      key: 'C',
      type: 'interface',
      id: 'discard',
      label: 'Carte au-dessus',
    },
  ],
  config: LAMA_CONFIGURATION,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'lama',
      handId: 'lama-hands',
    }),
  ],
  initialization: { scores: 0, startRound: false },
  initialPhase: LAMA_PHASES.initialPhase,
  phases: LAMA_PHASES.phases,
  ...GAME_RULES,
  actions: LAMA_ACTIONS,

  bot: GAME_BOT,
});
