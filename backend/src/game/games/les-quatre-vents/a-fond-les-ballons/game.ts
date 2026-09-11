import {
  cards,
  defineCardsSchema,
  defineGame,
  pawns,
  raceGame,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import {
  A_FOND_LES_BALLONS_CARDS,
  A_FOND_LES_BALLONS_PAWNS,
  A_FOND_LES_BALLONS_TILES,
  BALLOONS_GAME_CONTENT,
} from './content';
import manifest from './manifest.json';
import { GAME_CHOICES, A_FOND_LES_BALLONS_EFFECTS } from './rules';
import type { AFondLesBallonsState } from './state';

import { A_FOND_LES_BALLONS_ACTIONS, A_FOND_LES_BALLONS_PHASES } from './rules';
import { setupGame } from './rules';

const cardSchema = defineCardsSchema({
  decks: {
    loufoque: cards.deck({
      id: 'loufoque',
      cards: A_FOND_LES_BALLONS_CARDS,
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {},
});

export default defineGame<AFondLesBallonsState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: BALLOONS_GAME_CONTENT,
  patterns: [
    raceGame({
      trackId: 'balloons',
      spaces: A_FOND_LES_BALLONS_TILES.length,
      overshoot: 'bounce',
    }),
  ],
  components: [
    pawns.set({ id: 'balloons-pawns', pawns: A_FOND_LES_BALLONS_PAWNS }),
    ...cardSchema.components,
  ],
  initialization: { firstPlayer: 'random', startRound: true },
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    {
      key: 'Space',
      type: 'action',
      actionType: 'draw_card',
      label: 'Piocher',
    },
  ],
  setup: setupGame,
  initialPhase: A_FOND_LES_BALLONS_PHASES.initialPhase,
  phases: A_FOND_LES_BALLONS_PHASES.phases,
  actions: A_FOND_LES_BALLONS_ACTIONS,
  effects: A_FOND_LES_BALLONS_EFFECTS,
  choices: GAME_CHOICES,
  bot: GAME_BOT,
});
