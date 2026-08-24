import type { GameShortcutsBuilder } from '../../../models/game-shortcuts.model';
import { interfaceShortcut } from '../../../application/helpers/shortcut-utils';

export const buildFouleesFantastiquesShortcuts: GameShortcutsBuilder = () => [
  interfaceShortcut('E', 'stable'),
  interfaceShortcut('S', 'score'),
  interfaceShortcut('P', 'position'),
];
