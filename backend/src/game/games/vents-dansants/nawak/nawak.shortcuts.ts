import type { GameShortcutsBuilder } from '../../../models/game-shortcuts.model';
import { actionShortcut } from '../../../application/helpers/shortcut-utils';

export const buildNawakShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('C', 'choose_answer'),
  actionShortcut('V', 'vote_answer'),
];
