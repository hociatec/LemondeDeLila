import type { GameShortcutsBuilder } from '../../../../engine/shortcuts/game-shortcuts';
import { positionOnlyShortcuts } from '../../../../engine/shortcuts/shortcut-presets';

export const buildPiratesEnVadrouilleShortcuts: GameShortcutsBuilder = () =>
  positionOnlyShortcuts();
