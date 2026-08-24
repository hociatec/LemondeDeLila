import type { GameShortcutsBuilder } from '../../../application/models/game-shortcuts.model';
import { actionShortcut } from '../../../application/helpers/shortcut-utils';

export const buildLaParadeSucreeShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('C', 'play_card'),
  actionShortcut('S', 'pass'),
];
