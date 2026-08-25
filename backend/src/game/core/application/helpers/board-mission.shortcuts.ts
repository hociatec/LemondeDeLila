import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import { actionShortcut, interfaceShortcut } from '../../../shortcuts/public-api';

export const buildBoardMissionShortcuts: GameShortcutsBuilder = () => [
  interfaceShortcut('P', 'position'),
  actionShortcut('D', 'roll'),
  interfaceShortcut('S', 'score'),
];
