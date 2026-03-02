"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _entreritesshortcuts = require("../entre-rites.shortcuts");
describe('EntreRitesShortcuts', ()=>{
    it('returns an array', ()=>{
        const shortcuts = (0, _entreritesshortcuts.buildEntreRitesShortcuts)({
            metadata: {},
            currentPlayerId: 1,
            started: true
        });
        expect(Array.isArray(shortcuts)).toBe(true);
    });
});
