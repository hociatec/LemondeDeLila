"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildSacAMalicesShortcuts", {
    enumerable: true,
    get: function() {
        return buildSacAMalicesShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildSacAMalicesShortcuts = (ctx)=>{
    const metaRecord = ctx?.metadata && typeof ctx.metadata === 'object' ? ctx.metadata : {};
    const statuses = metaRecord.statuses && typeof metaRecord.statuses === 'object' ? metaRecord.statuses : {};
    const inJailByPlayer = statuses.inJail && typeof statuses.inJail === 'object' ? statuses.inJail : {};
    const jailCardsByPlayer = statuses.getOutOfJail && typeof statuses.getOutOfJail === 'object' ? statuses.getOutOfJail : {};
    const currentId = typeof ctx?.currentPlayerId === 'number' ? ctx.currentPlayerId : null;
    const inJail = currentId != null && Number(inJailByPlayer[String(currentId)] ?? 0) > 0;
    const jailCards = currentId != null ? Number(jailCardsByPlayer[String(currentId)] ?? 0) : 0;
    const rules = metaRecord.rules && typeof metaRecord.rules === 'object' ? metaRecord.rules : {};
    const jailRules = rules.jail && typeof rules.jail === 'object' ? rules.jail : {};
    const allowPayFine = Boolean(jailRules.allowPayFine) && Number(jailRules.autoFine ?? 0) > 0;
    const shortcuts = [
        (0, _shortcututils.interfaceShortcut)('P', 'position'),
        (0, _shortcututils.interfaceShortcut)('C', 'cash'),
        (0, _shortcututils.interfaceShortcut)('B', 'properties_all'),
        (0, _shortcututils.interfaceShortcut)('Z', 'properties_mine'),
        (0, _shortcututils.interfaceShortcut)('O', 'properties_others'),
        (0, _shortcututils.interfaceShortcut)('I', 'properties_available'),
        (0, _shortcututils.actionShortcut)('D', 'roll'),
        (0, _shortcututils.actionShortcut)('M', 'build'),
        (0, _shortcututils.actionShortcut)('V', 'sell_building'),
        (0, _shortcututils.actionShortcut)('H', 'mortgage'),
        (0, _shortcututils.actionShortcut)('L', 'unmortgage')
    ];
    if (inJail && allowPayFine) {
        shortcuts.push((0, _shortcututils.actionShortcut)('S', 'pay_fine'));
    }
    if (inJail && jailCards > 0) {
        shortcuts.push((0, _shortcututils.actionShortcut)('U', 'use_jail_card'));
    }
    return shortcuts;
};
