import {
  defineGame,
  gridGame,
  type NoGameState,
  pawns,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import { GAME_CONFIGURATION } from './configuration';
import {
  CORRIDOR_DEFAULT_WALLS,
  CORRIDOR_GAME_CONTENT,
  CORRIDOR_PAWNS,
  CORRIDOR_SIZE,
} from './content';
import manifest from './manifest.json';
import { GAME_CHOICES } from './rules';

import { CORRIDOR_ACTIONS, CORRIDOR_PHASES, CORRIDOR_WALLS } from './rules';
import { setupGame } from './setup-rules';

export default defineGame<NoGameState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsSacres',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: CORRIDOR_GAME_CONTENT,
  patterns: [
    gridGame({
      boardId: 'corridor',
      width: CORRIDOR_SIZE,
      height: CORRIDOR_SIZE,
    }),
  ],
  config: GAME_CONFIGURATION,
  components: [pawns.set({ id: 'corridor', pawns: CORRIDOR_PAWNS })],
  initialization: {
    resources: { [CORRIDOR_WALLS]: CORRIDOR_DEFAULT_WALLS },
    startRound: false,
  },
  shortcuts: [{ key: 'M', type: 'action', actionType: 'corridor_place_wall' }],
  setup: setupGame,
  initialPhase: CORRIDOR_PHASES.initialPhase,
  phases: CORRIDOR_PHASES.phases,
  actions: CORRIDOR_ACTIONS,
  choices: GAME_CHOICES,
  bot: GAME_BOT,
});
