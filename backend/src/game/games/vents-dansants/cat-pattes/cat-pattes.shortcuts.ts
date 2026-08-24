import type { GameShortcutsBuilder } from '../../../models/game-shortcuts.model';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../application/helpers/shortcut-utils';

export const buildCatPattesShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('SPACE', 'draw'),
  interfaceShortcut('S', 'score'),
  interfaceShortcut('P', 'position'),
  interfaceShortcut('I', 'info'),
  interfaceShortcut('C', 'discard'),
];
