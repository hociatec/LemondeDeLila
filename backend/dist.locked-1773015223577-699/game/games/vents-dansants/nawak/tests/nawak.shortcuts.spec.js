"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _nawakshortcuts = require("../nawak.shortcuts");
describe('NawakShortcuts', ()=>{
    it('returns hints array', ()=>{
        expect(Array.isArray((0, _nawakshortcuts.buildNawakShortcuts)({
            metadata: {},
            currentPlayerId: 1,
            started: true
        }))).toBe(true);
    });
});
