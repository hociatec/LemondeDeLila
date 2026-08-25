import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import { positionOnlyShortcuts } from '../../../shortcuts/public-api';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../shortcuts/public-api';

export const buildGaloponsShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  actionShortcut('SPACE', 'draw'),
  interfaceShortcut('S', 'apples'),
];
