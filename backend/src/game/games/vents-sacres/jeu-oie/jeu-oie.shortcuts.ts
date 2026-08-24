import type { GameShortcutsBuilder } from '../../../application/models/game-shortcuts.model';
import { actionShortcut } from '../../../application/helpers/shortcut-utils';
import { positionOnlyShortcuts } from '../../../application/helpers/shortcut-presets';

export const buildJeuOieShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  actionShortcut('SPACE', 'roll'),
];
