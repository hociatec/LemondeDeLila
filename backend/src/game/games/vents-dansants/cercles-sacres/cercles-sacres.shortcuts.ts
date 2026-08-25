import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import { actionShortcut } from '../../../shortcuts/public-api';

export const buildCerclesSacresShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('F', 'form_circle'),
  actionShortcut('D', 'discard_card'),
  actionShortcut('S', 'pass'),
];
