import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { actionShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildDameNatureShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('A', 'ask_card'),
  actionShortcut('S', 'pass'),
];
