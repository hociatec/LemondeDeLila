"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _lesabsurdissimesshortcuts = require("../les-absurdissimes.shortcuts");
describe('LesAbsurdissimesShortcuts', ()=>{
    it('returns an array', ()=>{
        expect(Array.isArray((0, _lesabsurdissimesshortcuts.buildAbsurdissimesShortcuts)({
            metadata: {},
            currentPlayerId: 1,
            started: true
        }))).toBe(true);
    });
});
