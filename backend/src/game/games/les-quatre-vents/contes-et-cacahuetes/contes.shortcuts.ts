import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../shortcuts/public-api';

export const buildContesShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('SPACE', 'draw'),
  interfaceShortcut('S', 'status'),
  interfaceShortcut('P', 'position'),
];

