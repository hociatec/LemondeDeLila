import type { GameShortcutsBuilder } from '../../../models/game-shortcuts.model';
import { actionShortcut } from '../../../application/helpers/shortcut-utils';

export const buildEntreRitesShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('S', 'pass'),
];
