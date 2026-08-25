import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import { positionOnlyShortcuts } from '../../../shortcuts/public-api';
import { actionShortcut } from '../../../shortcuts/public-api';

export const buildMinuitShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  actionShortcut('SPACE', 'draw'),
];
