import type { GameShortcutsBuilder } from '../../../../application/models/game-shortcuts.model';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../../application/helpers/shortcut-utils';

export const buildToutPresDeMamanShortcuts: GameShortcutsBuilder = () => [
  interfaceShortcut('P', 'position'),
  actionShortcut('SPACE', 'roll'),
  interfaceShortcut('S', 'score'),
];
