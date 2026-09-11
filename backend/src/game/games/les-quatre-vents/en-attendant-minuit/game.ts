import {
  cards,
  defineCardsSchema,
  defineGame,
  pawns,
  publicField,
  raceGame,
} from '../../../engine/sdk/public-api';
import {
  MINUIT_CARDS,
  MINUIT_GAME_CONTENT,
  MINUIT_PAWNS,
  MINUIT_TILES,
} from './content';
import manifest from './manifest.json';
import { GAME_CHOICES, MINUIT_EFFECTS } from './rules';

import { MINUIT_ACTIONS, MINUIT_PHASES } from './rules';
import { setupGame } from './rules';
import type { MinuitState } from './types';

const cardSchema = defineCardsSchema({
  decks: {
    noel: cards.deck({
      id: 'noel',
      cards: MINUIT_CARDS,
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {},
});

export default defineGame<MinuitState>()({
  id: manifest.code,
  rulesVersion: '2',
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: MINUIT_GAME_CONTENT,
  playerValuesVisibility: { statuses: publicField() },
  patterns: [
    raceGame({
      trackId: 'minuit',
      spaces: MINUIT_TILES.length,
      overshoot: 'bounce',
    }),
  ],
  components: [
    pawns.set({ id: 'minuit', pawns: MINUIT_PAWNS }),
    ...cardSchema.components,
  ],
  initialization: { firstPlayer: 'first', startRound: true },
  shortcuts: [{ key: 'D', type: 'action', actionType: 'roll' }],
  setup: setupGame,
  initialPhase: MINUIT_PHASES.initialPhase,
  phases: MINUIT_PHASES.phases,
  actions: MINUIT_ACTIONS,
  effects: MINUIT_EFFECTS,
  choices: GAME_CHOICES,
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
