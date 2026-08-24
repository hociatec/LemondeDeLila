import type { GameShortcutsBuilder } from '../../../models/game-shortcuts.model';
import { positionOnlyShortcuts } from '../../../application/helpers/shortcut-presets';
import { actionShortcut } from '../../../application/helpers/shortcut-utils';

export const buildFrousseShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  actionShortcut('SPACE', 'draw'),
];
