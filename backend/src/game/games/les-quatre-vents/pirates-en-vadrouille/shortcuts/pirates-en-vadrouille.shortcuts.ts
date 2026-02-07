import type { GameShortcutsBuilder } from '../../../../engine/shortcuts/game-shortcuts';
import { positionOnlyShortcuts } from '../../../../engine/shortcuts/shortcut-presets';
import { actionShortcut, interfaceShortcut } from '../../../../engine/shortcuts/shortcut-utils';

export const buildPiratesEnVadrouilleShortcuts: GameShortcutsBuilder = () => [
  ...positionOnlyShortcuts(),
  actionShortcut('SPACE', 'draw'),
  interfaceShortcut('S', 'score'),
];
