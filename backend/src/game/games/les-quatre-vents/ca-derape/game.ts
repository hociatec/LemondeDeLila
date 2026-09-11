import type { NoGameState as CaDerapeState } from '../../../engine/sdk/public-api';
import {
  cards,
  defineCardsSchema,
  defineGame,
  defineGamePhases,
  raceGame,
} from '../../../engine/sdk/public-api';
import { CA_DERAPE_ACTIONS, GAME_CHOICES } from './actions';
import {
  CA_DERAPE_CARDS,
  CA_DERAPE_GAME_CONTENT,
  CA_DERAPE_TILES,
} from './content';
import manifest from './manifest.json';
import { CA_DERAPE_EFFECTS } from './effects';

import { CA_NEXT_PLAYER_DELTA } from './rules';

const CA_DERAPE_PHASES = defineGamePhases<CaDerapeState>()({
  initialPhase: 'playing',
  phases: { playing: { terminal: true } },
});
const cardSchema = defineCardsSchema({
  decks: {
    situations: cards.deck({
      id: 'situations',
      cards: CA_DERAPE_CARDS,
      shuffle: true,
    }),
  },
  hands: {},
});

export default defineGame<CaDerapeState>()({
  id: manifest.code,
  rulesVersion: '2',
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: CA_DERAPE_GAME_CONTENT,
  patterns: [raceGame({ trackId: 'derape', spaces: CA_DERAPE_TILES.length })],
  components: [...cardSchema.components],
  initialization: {
    counters: { [CA_NEXT_PLAYER_DELTA]: 0 },
    startRound: false,
  },
  shortcuts: [{ key: 'D', type: 'action', actionType: 'roll' }],
  initialPhase: CA_DERAPE_PHASES.initialPhase,
  phases: CA_DERAPE_PHASES.phases,
  actions: CA_DERAPE_ACTIONS,
  effects: CA_DERAPE_EFFECTS,
  choices: GAME_CHOICES,
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
