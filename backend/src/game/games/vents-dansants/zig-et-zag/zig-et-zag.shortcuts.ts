import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { actionShortcut, interfaceShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildZigEtZagShortcuts: GameShortcutsBuilder = () => [
  interfaceShortcut('S', 'decks'),
  actionShortcut('SPACE', 'draw_card'),
];
