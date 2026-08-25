import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import { actionShortcut } from '../../../shortcuts/public-api';

export const buildLaGrandeMineDeBarbakShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('C', 'play_card'),
  actionShortcut('S', 'pass'),
];
