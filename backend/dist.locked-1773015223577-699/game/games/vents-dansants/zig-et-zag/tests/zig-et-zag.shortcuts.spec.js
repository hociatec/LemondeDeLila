"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _zigetzagshortcuts = require("../zig-et-zag.shortcuts");
describe('ZigEtZagShortcuts', ()=>{
    it('declares draw and deck info shortcuts', ()=>{
        const shortcuts = (0, _zigetzagshortcuts.buildZigEtZagShortcuts)({
            metadata: {},
            currentPlayerId: 1,
            started: true
        });
        expect(Array.isArray(shortcuts)).toBe(true);
        expect(shortcuts.some((s)=>s?.type === 'action' && String(s?.actionType).toLowerCase() === 'draw_card' && String(s?.key).toLowerCase() === 'pressed space')).toBe(true);
        expect(shortcuts.some((s)=>s?.type === 'interface' && String(s?.id).toLowerCase() === 'decks' && String(s?.key).toLowerCase() === 'pressed s')).toBe(true);
    });
});
