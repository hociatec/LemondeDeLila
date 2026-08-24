import type { GameShortcutsBuilder } from '../../../application/models/game-shortcuts.model';
import {
  interfaceShortcut,
  actionShortcut,
} from '../../../application/helpers/shortcut-utils';

export const buildSacAMalicesShortcuts: GameShortcutsBuilder = (ctx) => {
  const metaRecord =
    ctx?.metadata && typeof ctx.metadata === 'object'
      ? (ctx.metadata as Record<string, unknown>)
      : {};
  const statuses =
    metaRecord.statuses && typeof metaRecord.statuses === 'object'
      ? (metaRecord.statuses as Record<string, unknown>)
      : {};
  const inJailByPlayer =
    statuses.inJail && typeof statuses.inJail === 'object'
      ? (statuses.inJail as Record<string, unknown>)
      : {};
  const jailCardsByPlayer =
    statuses.getOutOfJail && typeof statuses.getOutOfJail === 'object'
      ? (statuses.getOutOfJail as Record<string, unknown>)
      : {};
  const currentId =
    typeof ctx?.currentPlayerId === 'number' ? ctx.currentPlayerId : null;
  const inJail =
    currentId != null && Number(inJailByPlayer[String(currentId)] ?? 0) > 0;
  const jailCards =
    currentId != null ? Number(jailCardsByPlayer[String(currentId)] ?? 0) : 0;
  const rules =
    metaRecord.rules && typeof metaRecord.rules === 'object'
      ? (metaRecord.rules as Record<string, unknown>)
      : {};
  const jailRules =
    rules.jail && typeof rules.jail === 'object'
      ? (rules.jail as Record<string, unknown>)
      : {};
  const allowPayFine =
    Boolean(jailRules.allowPayFine) && Number(jailRules.autoFine ?? 0) > 0;

  const shortcuts = [
    interfaceShortcut('P', 'position'),
    interfaceShortcut('C', 'cash'),
    interfaceShortcut('B', 'properties_all'),
    interfaceShortcut('Z', 'properties_mine'),
    interfaceShortcut('O', 'properties_others'),
    interfaceShortcut('I', 'properties_available'),
    actionShortcut('D', 'roll'),
    actionShortcut('M', 'build'),
    actionShortcut('V', 'sell_building'),
    actionShortcut('H', 'mortgage'),
    actionShortcut('L', 'unmortgage'),
  ];

  if (inJail && allowPayFine) {
    shortcuts.push(actionShortcut('S', 'pay_fine'));
  }
  if (inJail && jailCards > 0) {
    shortcuts.push(actionShortcut('U', 'use_jail_card'));
  }

  return shortcuts;
};

