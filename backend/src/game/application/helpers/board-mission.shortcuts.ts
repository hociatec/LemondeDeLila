import type { GameShortcutsBuilder } from '../models/game-shortcuts.model';
import { actionShortcut, interfaceShortcut } from './shortcut-utils';

export const buildBoardMissionShortcuts: GameShortcutsBuilder = () => [
  interfaceShortcut('P', 'position'),
  actionShortcut('D', 'roll'),
  interfaceShortcut('S', 'score'),
];
