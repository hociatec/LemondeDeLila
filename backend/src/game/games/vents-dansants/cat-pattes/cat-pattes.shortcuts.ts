import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../engine/shortcuts/shortcut-utils';

export const buildCatPattesShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('SPACE', 'draw'),
  actionShortcut('D', 'discard_card'),
  interfaceShortcut('S', 'score'),
  interfaceShortcut('P', 'position'),
  interfaceShortcut('I', 'info'),
];
