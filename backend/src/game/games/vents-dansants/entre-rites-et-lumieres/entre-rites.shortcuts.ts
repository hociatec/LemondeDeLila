import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { actionShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildEntreRitesShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('S', 'pass'),
];
