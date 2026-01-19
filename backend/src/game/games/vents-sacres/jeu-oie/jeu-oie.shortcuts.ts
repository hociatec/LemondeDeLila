import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { interfaceShortcut } from '../../../engine/shortcuts/shortcut-utils';
import { positionOnlyShortcuts } from '../../../engine/shortcuts/shortcut-presets';

export const buildJeuOieShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  interfaceShortcut('B', 'board'),
];
