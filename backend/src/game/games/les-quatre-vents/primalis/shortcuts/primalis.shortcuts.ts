import type { GameShortcutsBuilder } from '../../../../shortcuts/public-api';
import { positionOnlyShortcuts } from '../../../../shortcuts/public-api';
import { interfaceShortcut } from '../../../../shortcuts/public-api';

export const buildPrimalisShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  interfaceShortcut('S', 'score'),
  interfaceShortcut('V', 'ressources'),
];

