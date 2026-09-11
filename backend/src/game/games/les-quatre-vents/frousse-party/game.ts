import type { NoGameState as FrousseState } from '../../../engine/sdk/public-api';
import {
  cards,
  defineCardsSchema,
  defineGame,
  pawns,
  publicField,
  raceGame,
} from '../../../engine/sdk/public-api';
import {
  FROUSSE_CARDS,
  FROUSSE_GAME_CONTENT,
  FROUSSE_PAWNS,
  FROUSSE_TILES,
} from './content';
import manifest from './manifest.json';
import { GAME_CHOICES, FROUSSE_EFFECTS } from './rules';

import { FROUSSE_ACTIONS, FROUSSE_PHASES } from './rules';
import { setupGame } from './rules';

const cardSchema = defineCardsSchema({
  decks: {
    frights: cards.deck({
      id: 'frights',
      cards: FROUSSE_CARDS,
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {},
});

export default defineGame<FrousseState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: FROUSSE_GAME_CONTENT,
  playerValuesVisibility: { statuses: publicField() },
  patterns: [
    raceGame({
      trackId: 'manor',
      spaces: FROUSSE_TILES.length,
      overshoot: 'bounce',
    }),
  ],
  components: [
    pawns.set({ id: 'frousse', pawns: FROUSSE_PAWNS }),
    ...cardSchema.components,
  ],
  initialization: { firstPlayer: 'random', startRound: true },
  shortcuts: [{ key: 'D', type: 'action', actionType: 'roll' }],
  setup: setupGame,
  initialPhase: FROUSSE_PHASES.initialPhase,
  phases: FROUSSE_PHASES.phases,
  actions: FROUSSE_ACTIONS,
  effects: FROUSSE_EFFECTS,
  choices: GAME_CHOICES,
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
