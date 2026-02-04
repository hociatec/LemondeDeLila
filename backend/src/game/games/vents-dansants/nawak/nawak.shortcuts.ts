import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { actionShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildNawakShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('C', 'choose_answer'),
  actionShortcut('V', 'vote_answer'),
];
