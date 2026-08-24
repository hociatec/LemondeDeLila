import type { GameShortcutsBuilder } from '../../../../application/models/game-shortcuts.model';
import { positionOnlyShortcuts } from '../../../../application/helpers/shortcut-presets';
import { interfaceShortcut } from '../../../../application/helpers/shortcut-utils';

export const buildMonVillageShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  interfaceShortcut('I', 'cartes'),
  interfaceShortcut('V', 'available'),
  interfaceShortcut('S', 'score'),
];
