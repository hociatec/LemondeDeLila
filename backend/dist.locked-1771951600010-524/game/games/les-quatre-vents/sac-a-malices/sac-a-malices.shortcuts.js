"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSacAMalicesShortcuts = void 0;
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildSacAMalicesShortcuts = (ctx) => {
    const metaRecord = ctx?.metadata && typeof ctx.metadata === 'object'
        ? ctx.metadata
        : {};
    const statuses = metaRecord.statuses && typeof metaRecord.statuses === 'object'
        ? metaRecord.statuses
        : {};
    const inJailByPlayer = statuses.inJail && typeof statuses.inJail === 'object'
        ? statuses.inJail
        : {};
    const jailCardsByPlayer = statuses.getOutOfJail && typeof statuses.getOutOfJail === 'object'
        ? statuses.getOutOfJail
        : {};
    const currentId = typeof ctx?.currentPlayerId === 'number' ? ctx.currentPlayerId : null;
    const inJail = currentId != null && Number(inJailByPlayer[String(currentId)] ?? 0) > 0;
    const jailCards = currentId != null ? Number(jailCardsByPlayer[String(currentId)] ?? 0) : 0;
    const rules = metaRecord.rules && typeof metaRecord.rules === 'object'
        ? metaRecord.rules
        : {};
    const jailRules = rules.jail && typeof rules.jail === 'object'
        ? rules.jail
        : {};
    const allowPayFine = Boolean(jailRules.allowPayFine) && Number(jailRules.autoFine ?? 0) > 0;
    const shortcuts = [
        (0, shortcut_utils_1.interfaceShortcut)('P', 'position'),
        (0, shortcut_utils_1.interfaceShortcut)('C', 'cash'),
        (0, shortcut_utils_1.interfaceShortcut)('B', 'properties_all'),
        (0, shortcut_utils_1.interfaceShortcut)('Z', 'properties_mine'),
        (0, shortcut_utils_1.interfaceShortcut)('O', 'properties_others'),
        (0, shortcut_utils_1.interfaceShortcut)('I', 'properties_available'),
        (0, shortcut_utils_1.actionShortcut)('D', 'roll'),
        (0, shortcut_utils_1.actionShortcut)('M', 'build'),
        (0, shortcut_utils_1.actionShortcut)('V', 'sell_building'),
        (0, shortcut_utils_1.actionShortcut)('H', 'mortgage'),
        (0, shortcut_utils_1.actionShortcut)('L', 'unmortgage'),
    ];
    if (inJail && allowPayFine) {
        shortcuts.push((0, shortcut_utils_1.actionShortcut)('S', 'pay_fine'));
    }
    if (inJail && jailCards > 0) {
        shortcuts.push((0, shortcut_utils_1.actionShortcut)('U', 'use_jail_card'));
    }
    return shortcuts;
};
exports.buildSacAMalicesShortcuts = buildSacAMalicesShortcuts;
//# sourceMappingURL=sac-a-malices.shortcuts.js.map