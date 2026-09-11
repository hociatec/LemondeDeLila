import type { NoGameState as GaloponsState } from '../../../engine/sdk/public-api';
import {
  cards,
  defineCardsSchema,
  defineGame,
  pawns,
  raceGame,
} from '../../../engine/sdk/public-api';
import {
  GALOPONS_CARDS,
  GALOPONS_GAME_CONTENT,
  GALOPONS_PAWNS,
  GALOPONS_TILES,
} from './content';
import manifest from './manifest.json';
import { GAME_CHOICES, GAME_EFFECTS } from './rules';

import { GALOPONS_ACTIONS, GALOPONS_PHASES } from './rules';
import { setupGame } from './rules';

const cardSchema = defineCardsSchema({
  decks: {
    adventure: cards.deck({
      id: 'adventure',
      cards: GALOPONS_CARDS,
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {},
});

export default defineGame<GaloponsState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: GALOPONS_GAME_CONTENT,
  patterns: [raceGame({ trackId: 'galopons', spaces: GALOPONS_TILES.length })],
  components: [
    pawns.set({ id: 'galopons', pawns: GALOPONS_PAWNS }),
    ...cardSchema.components,
  ],
  resourceIds: ['apple'],
  initialization: { firstPlayer: 'first', startRound: true },
  shortcuts: [{ key: 'D', type: 'action', actionType: 'roll' }],
  setup: setupGame,
  initialPhase: GALOPONS_PHASES.initialPhase,
  phases: GALOPONS_PHASES.phases,
  actions: GALOPONS_ACTIONS,
  choices: GAME_CHOICES,
  effects: GAME_EFFECTS,

  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
