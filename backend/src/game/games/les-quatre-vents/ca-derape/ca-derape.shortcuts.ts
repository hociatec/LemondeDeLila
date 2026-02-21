import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { positionOnlyShortcuts } from '../../../engine/shortcuts/shortcut-presets';
import { actionShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildCaDerapeShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  actionShortcut('SPACE', 'draw'),
];
