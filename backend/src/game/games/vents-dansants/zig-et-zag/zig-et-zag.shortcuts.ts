import type { GameShortcutsBuilder } from '../../../models/game-shortcuts.model';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../application/helpers/shortcut-utils';

export const buildZigEtZagShortcuts: GameShortcutsBuilder = () => [
  interfaceShortcut('S', 'decks'),
  actionShortcut('SPACE', 'draw_card'),
];
