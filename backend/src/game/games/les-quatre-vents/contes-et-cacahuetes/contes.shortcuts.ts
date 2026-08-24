import type { GameShortcutsBuilder } from '../../../application/models/game-shortcuts.model';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../application/helpers/shortcut-utils';

export const buildContesShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('SPACE', 'draw'),
  interfaceShortcut('S', 'status'),
  interfaceShortcut('P', 'position'),
];

