import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../shortcuts/public-api';

export const buildCatPattesShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('SPACE', 'draw'),
  interfaceShortcut('S', 'score'),
  interfaceShortcut('P', 'position'),
  interfaceShortcut('I', 'info'),
  interfaceShortcut('C', 'discard'),
];
