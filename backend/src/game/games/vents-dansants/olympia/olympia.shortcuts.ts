import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import { actionShortcut } from '../../../shortcuts/public-api';

export const buildOlympiaShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('D', 'draw_card'),
  actionShortcut('C', 'play_card'),
  actionShortcut('S', 'pass'),
];
