import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { actionShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildCerclesSacresShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('F', 'form_circle'),
  actionShortcut('D', 'discard_card'),
  actionShortcut('S', 'pass'),
];
