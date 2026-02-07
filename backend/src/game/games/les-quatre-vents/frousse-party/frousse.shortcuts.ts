import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { positionOnlyShortcuts } from '../../../engine/shortcuts/shortcut-presets';
import { actionShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildFrousseShortcuts: GameShortcutsBuilder = () =>
  [...positionOnlyShortcuts(), actionShortcut('SPACE', 'draw')];
