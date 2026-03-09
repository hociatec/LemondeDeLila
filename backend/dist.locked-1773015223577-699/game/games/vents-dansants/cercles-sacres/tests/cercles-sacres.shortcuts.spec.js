"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _cerclessacresshortcuts = require("../cercles-sacres.shortcuts");
describe('CerclesSacresShortcuts', ()=>{
    it('returns an array of hints', ()=>{
        const shortcuts = (0, _cerclessacresshortcuts.buildCerclesSacresShortcuts)({
            metadata: {},
            currentPlayerId: 1,
            started: true
        });
        expect(Array.isArray(shortcuts)).toBe(true);
    });
});
