import type { GameShortcutsBuilder } from '../../../../shortcuts/public-api';
import { positionOnlyShortcuts } from '../../../../shortcuts/public-api';
import { interfaceShortcut } from '../../../../shortcuts/public-api';

export const buildMonVillageShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  interfaceShortcut('I', 'cartes'),
  interfaceShortcut('V', 'available'),
  interfaceShortcut('S', 'score'),
];
