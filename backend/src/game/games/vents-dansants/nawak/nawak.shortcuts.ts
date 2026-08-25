import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import { actionShortcut } from '../../../shortcuts/public-api';

export const buildNawakShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('C', 'choose_answer'),
  actionShortcut('V', 'vote_answer'),
];
