import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { interfaceShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildFouleesFantastiquesShortcuts: GameShortcutsBuilder = () =>
  [interfaceShortcut('E', 'stable'), interfaceShortcut('P', 'position')];
