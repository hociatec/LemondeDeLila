import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { actionShortcut } from '../../../engine/shortcuts/shortcut-utils';
import { positionOnlyShortcuts } from '../../../engine/shortcuts/shortcut-presets';

export const buildJeuOieShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  actionShortcut('SPACE', 'roll'),
];
