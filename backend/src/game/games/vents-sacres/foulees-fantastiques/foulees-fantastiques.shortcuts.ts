import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import { interfaceShortcut } from '../../../shortcuts/public-api';

export const buildFouleesFantastiquesShortcuts: GameShortcutsBuilder = () => [
  interfaceShortcut('E', 'stable'),
  interfaceShortcut('S', 'score'),
  interfaceShortcut('P', 'position'),
];
