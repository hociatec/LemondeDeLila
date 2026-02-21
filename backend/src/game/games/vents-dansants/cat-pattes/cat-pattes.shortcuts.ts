import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../engine/shortcuts/shortcut-utils';

export const buildCatPattesShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('SPACE', 'draw'),
  interfaceShortcut('S', 'score'),
  interfaceShortcut('P', 'position'),
];
