import type { GameShortcutsBuilder } from '../../../../engine/shortcuts/game-shortcuts';
import { positionOnlyShortcuts } from '../../../../engine/shortcuts/shortcut-presets';
import { interfaceShortcut } from '../../../../engine/shortcuts/shortcut-utils';

export const buildMonVillageShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  interfaceShortcut('I', 'cartes'),
  interfaceShortcut('V', 'available'),
  interfaceShortcut('S', 'score'),
];
