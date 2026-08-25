import type { GameShortcutsBuilder } from '../../../../shortcuts/public-api';
import { positionOnlyShortcuts } from '../../../../shortcuts/public-api';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../../shortcuts/public-api';

export const buildPiratesEnVadrouilleShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  actionShortcut('SPACE', 'draw'),
  interfaceShortcut('S', 'score'),
];

