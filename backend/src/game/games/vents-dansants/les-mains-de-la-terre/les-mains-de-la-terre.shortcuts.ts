import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import { actionShortcut } from '../../../shortcuts/public-api';

export const buildLesMainsDeLaTerreShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('R', 'request_card'),
];
