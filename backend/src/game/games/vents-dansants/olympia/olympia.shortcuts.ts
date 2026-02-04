import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { actionShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildOlympiaShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('D', 'draw_card'),
  actionShortcut('C', 'play_card'),
  actionShortcut('S', 'pass'),
];
