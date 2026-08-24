import type { GameShortcutsBuilder } from '../../../application/models/game-shortcuts.model';
import { actionShortcut } from '../../../application/helpers/shortcut-utils';

export const buildGerardPresidentShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('T', 'set_theme'),
  actionShortcut('N', 'play_name'),
  actionShortcut('S', 'play_special'),
  actionShortcut('W', 'choose_winner'),
  actionShortcut('P', 'pass'),
];
