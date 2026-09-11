import { defineGame, pawnRace } from '../../../engine/sdk/public-api';
import { FOULEES_BOARD, FOULEES_GAME_CONTENT, FOULEES_PAWNS } from './content';
import manifest from './manifest.json';
import { GAME_CHOICES } from './rules';

import { FOULEES_ACTIONS, FOULEES_PHASES } from './rules';
import { setupGame } from './rules';
import type { FouleesState } from './types';

export default defineGame<FouleesState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsSacres',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: FOULEES_GAME_CONTENT,
  patterns: [
    pawnRace({
      pawnSetId: 'foulees',
      pawns: FOULEES_PAWNS,
      perPlayer: 4,
      spaces: FOULEES_BOARD.trackLength + FOULEES_BOARD.homeLength,
      initialPosition: -1,
      homeStretchFrom: FOULEES_BOARD.trackLength,
    }),
  ],
  shortcuts: [{ key: 'D', type: 'action', actionType: 'roll' }],
  setup: setupGame,
  initialPhase: FOULEES_PHASES.initialPhase,
  phases: FOULEES_PHASES.phases,
  actions: FOULEES_ACTIONS,
  choices: GAME_CHOICES,
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
