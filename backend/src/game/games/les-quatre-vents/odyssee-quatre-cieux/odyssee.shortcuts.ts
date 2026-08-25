import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import { positionOnlyShortcuts } from '../../../shortcuts/public-api';
import { interfaceShortcut } from '../../../shortcuts/public-api';

export const buildOdysseeShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  interfaceShortcut('E', 'stable'),
  interfaceShortcut('S', 'score'),
];
