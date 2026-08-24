import type { GameShortcutsBuilder } from '../../../application/models/game-shortcuts.model';
import { actionShortcut } from '../../../application/helpers/shortcut-utils';

export const buildDameNatureShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('S', 'pass'),
];
