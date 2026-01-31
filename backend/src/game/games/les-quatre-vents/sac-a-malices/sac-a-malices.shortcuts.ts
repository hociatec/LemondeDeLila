import type { GameShortcutsBuilder } from '../../../engine/shortcuts/game-shortcuts';
import { interfaceShortcut, actionShortcut } from '../../../engine/shortcuts/shortcut-utils';

export const buildSacAMalicesShortcuts: GameShortcutsBuilder = (ctx) => {
  const meta: any = ctx?.metadata ?? {};
  const currentId =
    typeof ctx?.currentPlayerId === 'number' ? ctx.currentPlayerId : null;
  const inJail =
    currentId != null && Number(meta?.statuses?.inJail?.[currentId] ?? 0) > 0;
  const jailCards =
    currentId != null ? Number(meta?.statuses?.getOutOfJail?.[currentId] ?? 0) : 0;
  const rules: any = meta?.rules ?? {};
  const allowPayFine =
    Boolean(rules?.jail?.allowPayFine) &&
    Number(rules?.jail?.autoFine ?? 0) > 0;

  const shortcuts = [
    interfaceShortcut('S', 'position'),
    actionShortcut('D', 'roll'),
    actionShortcut('F', 'build'),
    actionShortcut('V', 'sell_building'),
    actionShortcut('H', 'mortgage'),
    actionShortcut('L', 'unmortgage'),
  ];

  if (inJail && allowPayFine) {
    shortcuts.push(actionShortcut('P', 'pay_fine'));
  }
  if (inJail && jailCards > 0) {
    shortcuts.push(actionShortcut('U', 'use_jail_card'));
  }

  return shortcuts;
};
