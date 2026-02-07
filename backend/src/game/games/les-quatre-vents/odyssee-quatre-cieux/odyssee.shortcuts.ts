import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { positionOnlyShortcuts } from '../../../engine/shortcuts/shortcut-presets';
import { interfaceShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildOdysseeShortcuts: GameShortcutsBuilder = () =>
  [
    ...positionOnlyShortcuts(),
    interfaceShortcut('E', 'stable'),
    interfaceShortcut('S', 'score'),
  ];
