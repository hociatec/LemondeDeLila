import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import { actionShortcut } from '../../../shortcuts/public-api';

export const buildGerardPresidentShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('T', 'set_theme'),
  actionShortcut('N', 'play_name'),
  actionShortcut('S', 'play_special'),
  actionShortcut('W', 'choose_winner'),
  actionShortcut('P', 'pass'),
];
