import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { actionShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildZigEtZagShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('P', 'draw_card'),
];
