import type { GameShortcutsBuilder } from '../../../application/models/game-shortcuts.model';
import { actionShortcut } from '../../../application/helpers/shortcut-utils';

export const buildLesMainsDeLaTerreShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('R', 'request_card'),
];
