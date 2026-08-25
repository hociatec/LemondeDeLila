import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import { actionShortcut } from '../../../shortcuts/public-api';

export const buildEntreRitesShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('S', 'pass'),
];
