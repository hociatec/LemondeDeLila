import type { GameShortcutsBuilder } from '../../../../engine/shortcuts/game-shortcuts';
import { positionOnlyShortcuts } from '../../../../engine/shortcuts/shortcut-presets';
import { interfaceShortcut } from '../../../../engine/shortcuts/shortcut-utils';

export const buildPrimalisShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  interfaceShortcut('S', 'score'),
  interfaceShortcut('V', 'ressources'),
];
