"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _lagrandeminedebarbakshortcuts = require("../la-grande-mine-de-barbak.shortcuts");
describe('LaGrandeMineDeBarbak shortcuts', ()=>{
    it('returns an array', ()=>{
        const shortcuts = (0, _lagrandeminedebarbakshortcuts.buildLaGrandeMineDeBarbakShortcuts)({
            metadata: {},
            currentPlayerId: 1,
            started: true
        });
        expect(Array.isArray(shortcuts)).toBe(true);
    });
});
