import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { actionShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildDameNatureShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('S', 'pass'),
];
