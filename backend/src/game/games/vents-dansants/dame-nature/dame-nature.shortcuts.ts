import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import { actionShortcut } from '../../../shortcuts/public-api';

export const buildDameNatureShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('S', 'pass'),
];
