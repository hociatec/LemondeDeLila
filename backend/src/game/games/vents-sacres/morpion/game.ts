import type { NoGameState as MorpionState } from '../../../engine/sdk/public-api';
import { defineGame, gridGame, pawns } from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import { MORPION_GAME_CONTENT, MORPION_PAWNS } from './content';
import manifest from './manifest.json';
import { GAME_CHOICES } from './rules';

import { MARK_PLACED, MORPION_ACTIONS } from './rules';
import { setupGame } from './rules';

export default defineGame<MorpionState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'Les Vents Sacrés',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  events: [MARK_PLACED],
  content: MORPION_GAME_CONTENT,
  patterns: [
    gridGame({
      boardId: 'morpion',
      width: 3,
      height: 3,
      winLength: 3,
      drawWhenFull: true,
      winnerReason: 'line-3',
      drawReason: 'draw',
    }),
  ],
  components: [pawns.set({ id: 'morpion', pawns: MORPION_PAWNS })],
  initialization: { firstPlayer: 'first', startRound: true },
  shortcuts: [
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'A', type: 'interface', id: 'play' },
  ],
  setup: setupGame,
  actions: MORPION_ACTIONS,
  choices: GAME_CHOICES,
  bot: GAME_BOT,
});
