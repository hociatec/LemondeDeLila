import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { actionShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildEntreRitesShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('A', 'ask_card'),
  actionShortcut('S', 'pass'),
];
