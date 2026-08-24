import type { GameShortcutsBuilder } from '../../../models/game-shortcuts.model';
import { positionOnlyShortcuts } from '../../../application/helpers/shortcut-presets';
import { interfaceShortcut } from '../../../application/helpers/shortcut-utils';

export const buildOdysseeShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  interfaceShortcut('E', 'stable'),
  interfaceShortcut('S', 'score'),
];
