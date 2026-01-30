import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { interfaceShortcut, actionShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildSacAMalicesShortcuts: GameShortcutsBuilder = () =>
  [
    interfaceShortcut('S', 'position'),
    actionShortcut('D', 'roll'),
    actionShortcut('F', 'build'),
    actionShortcut('V', 'sell_building'),
    actionShortcut('H', 'mortgage'),
    actionShortcut('L', 'unmortgage'),
    actionShortcut('P', 'pay_fine'),
    actionShortcut('U', 'use_jail_card'),
  ];
