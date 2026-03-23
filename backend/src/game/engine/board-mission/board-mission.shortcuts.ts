import type { GameShortcutsBuilder } from '../shortcuts/game-shortcuts';
import {
  actionShortcut,
  interfaceShortcut,
} from '../shortcuts/shortcut-utils';

export const buildBoardMissionShortcuts: GameShortcutsBuilder = () => [
  interfaceShortcut('P', 'position'),
  actionShortcut('SPACE', 'roll'),
  interfaceShortcut('S', 'score'),
];
