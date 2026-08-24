import type { GameShortcutsBuilder } from '../../../application/models/game-shortcuts.model';
import { actionShortcut } from '../../../application/helpers/shortcut-utils';

export const buildPimpMyRideShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('C', 'play_card'),
  actionShortcut('D', 'discard_card'),
  actionShortcut('S', 'pass'),
];
