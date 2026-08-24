import type { GameShortcutsBuilder } from '../../../application/models/game-shortcuts.model';
import { actionShortcut } from '../../../application/helpers/shortcut-utils';

export const buildCerclesSacresShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('F', 'form_circle'),
  actionShortcut('D', 'discard_card'),
  actionShortcut('S', 'pass'),
];
