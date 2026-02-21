import type { GameShortcutsBuilder } from '../../../../engine/shortcuts/game-shortcuts';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../../engine/shortcuts/shortcut-utils';

export const buildToutPresDeMamanShortcuts: GameShortcutsBuilder = () => [
  interfaceShortcut('P', 'position'),
  actionShortcut('SPACE', 'roll'),
  interfaceShortcut('S', 'score'),
];
