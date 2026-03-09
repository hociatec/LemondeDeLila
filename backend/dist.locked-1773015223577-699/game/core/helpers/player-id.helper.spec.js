"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _playeridhelper = require("./player-id.helper");
describe('player-id.helper', ()=>{
    it('parses finite numbers and numeric strings', ()=>{
        expect((0, _playeridhelper.toPlayerId)(7)).toBe(7);
        expect((0, _playeridhelper.toPlayerId)(' 12 ')).toBe(12);
    });
    it('rejects empty, invalid and non-finite values', ()=>{
        expect((0, _playeridhelper.toPlayerId)('')).toBeNull();
        expect((0, _playeridhelper.toPlayerId)('abc')).toBeNull();
        expect((0, _playeridhelper.toPlayerId)(NaN)).toBeNull();
        expect((0, _playeridhelper.toPlayerId)(Infinity)).toBeNull();
    });
});
