import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../shortcuts/public-api';

export const buildZigEtZagShortcuts: GameShortcutsBuilder = () => [
  interfaceShortcut('S', 'decks'),
  actionShortcut('SPACE', 'draw_card'),
];
