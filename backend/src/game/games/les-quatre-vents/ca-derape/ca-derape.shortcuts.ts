import type { GameShortcutsBuilder } from '../../../application/models/game-shortcuts.model';
import { positionOnlyShortcuts } from '../../../application/helpers/shortcut-presets';
import { actionShortcut } from '../../../application/helpers/shortcut-utils';

export const buildCaDerapeShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  actionShortcut('SPACE', 'draw'),
];
