import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { actionShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildGerardPresidentShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('T', 'set_theme'),
  actionShortcut('N', 'play_name'),
  actionShortcut('S', 'play_special'),
  actionShortcut('W', 'choose_winner'),
  actionShortcut('P', 'pass'),
];
