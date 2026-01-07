import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { stableAndPositionShortcuts } from '../../../engine/shortcuts/shortcut-presets';

export const buildPetitChevauxShortcuts: GameShortcutsBuilder = () =>
  stableAndPositionShortcuts();
