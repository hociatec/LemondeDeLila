import type { GameShortcutsBuilder } from '../../../../models/game-shortcuts.model';
import { positionOnlyShortcuts } from '../../../../application/helpers/shortcut-presets';
import { interfaceShortcut } from '../../../../application/helpers/shortcut-utils';

export const buildPrimalisShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  interfaceShortcut('S', 'score'),
  interfaceShortcut('V', 'ressources'),
];

