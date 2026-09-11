import {
  defineGame,
  pawns,
  publicField,
  raceGame,
} from '../../../engine/sdk/public-api';
import { GOOSE_GAME_CONTENT, GOOSE_PAWNS, GOOSE_TILES } from './content';
import manifest from './manifest.json';
import { GAME_CHOICES } from './rules';

import { JEU_OIE_ACTIONS, JEU_OIE_PHASES } from './rules';
import { setupGame } from './rules';
import type { JeuOieState } from './types';

export default defineGame<JeuOieState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsSacres',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: GOOSE_GAME_CONTENT,
  rulesVersion: '2',
  initialization: { tracks: { 'goose-board': 1 } },
  playerValuesVisibility: { statuses: publicField() },
  patterns: [
    raceGame({
      trackId: 'goose-board',
      spaces: GOOSE_TILES.length,
      overshoot: 'bounce',
    }),
  ],
  components: [pawns.set({ id: 'goose', pawns: GOOSE_PAWNS })],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
  ],
  setup: setupGame,
  initialPhase: JEU_OIE_PHASES.initialPhase,
  phases: JEU_OIE_PHASES.phases,
  actions: JEU_OIE_ACTIONS,
  choices: GAME_CHOICES,
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
