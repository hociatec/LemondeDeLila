"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _contesshortcuts = require("../contes.shortcuts");
describe('ContesShortcuts', ()=>{
    it('declares draw, score and position shortcuts', ()=>{
        const shortcuts = (0, _contesshortcuts.buildContesShortcuts)({
            metadata: {},
            currentPlayerId: 1,
            started: true
        });
        expect(Array.isArray(shortcuts)).toBe(true);
        expect(shortcuts.some((shortcut)=>String(shortcut.type ?? '') === 'action' && String(shortcut.actionType ?? '') === 'draw')).toBe(true);
        expect(shortcuts.some((shortcut)=>String(shortcut.type ?? '') === 'interface' && String(shortcut.id ?? '') === 'score')).toBe(true);
        expect(shortcuts.some((shortcut)=>String(shortcut.type ?? '') === 'interface' && String(shortcut.id ?? '') === 'position')).toBe(true);
    });
});
