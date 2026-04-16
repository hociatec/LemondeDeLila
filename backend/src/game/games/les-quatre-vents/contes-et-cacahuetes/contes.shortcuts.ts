import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../engine/shortcuts/shortcut-utils';

export const buildContesShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('SPACE', 'draw'),
  interfaceShortcut('S', 'status'),
  interfaceShortcut('P', 'position'),
];
