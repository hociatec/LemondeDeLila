import type { GameShortcutsBuilder } from '../../../../shortcuts/public-api';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../../shortcuts/public-api';

export const buildToutPresDeMamanShortcuts: GameShortcutsBuilder = () => [
  interfaceShortcut('P', 'position'),
  actionShortcut('SPACE', 'roll'),
  interfaceShortcut('S', 'score'),
];
