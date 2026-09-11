import { defineGame, raceGame } from '../../../engine/sdk/public-api';
import { PRIMALIS_GAME_CONTENT, PRIMALIS_TILES } from './content';
import manifest from './manifest.json';
import { GAME_VICTORY } from './rules';

import {
  PRIMALIS_ACTIONS,
  PRIMALIS_DANGER_AMPLIFIED,
  ROLL_RESOLVED,
} from './rules';
import type { PrimalisState } from './types';

export default defineGame<PrimalisState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  events: [ROLL_RESOLVED],
  content: PRIMALIS_GAME_CONTENT,
  patterns: [raceGame({ trackId: 'comet', spaces: PRIMALIS_TILES.length })],
  initialization: {
    resources: {
      herbivores: 2,
      carnivores: 0,
      eggs: 0,
      leaves: 2,
    },
    counters: { [PRIMALIS_DANGER_AMPLIFIED]: 0 },
    startRound: false,
  },
  shortcuts: [
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'S', type: 'interface', id: 'score' },
    { key: 'V', type: 'interface', id: 'ressources' },
  ],
  actions: PRIMALIS_ACTIONS,
  victory: GAME_VICTORY,
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
