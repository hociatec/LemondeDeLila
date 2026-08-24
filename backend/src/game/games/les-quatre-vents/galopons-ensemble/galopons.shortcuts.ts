import type { GameShortcutsBuilder } from '../../../application/models/game-shortcuts.model';
import { positionOnlyShortcuts } from '../../../application/helpers/shortcut-presets';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../application/helpers/shortcut-utils';

export const buildGaloponsShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  actionShortcut('SPACE', 'draw'),
  interfaceShortcut('S', 'apples'),
];
