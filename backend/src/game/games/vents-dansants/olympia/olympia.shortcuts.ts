import type { GameShortcutsBuilder } from '../../../models/game-shortcuts.model';
import { actionShortcut } from '../../../application/helpers/shortcut-utils';

export const buildOlympiaShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('D', 'draw_card'),
  actionShortcut('C', 'play_card'),
  actionShortcut('S', 'pass'),
];
