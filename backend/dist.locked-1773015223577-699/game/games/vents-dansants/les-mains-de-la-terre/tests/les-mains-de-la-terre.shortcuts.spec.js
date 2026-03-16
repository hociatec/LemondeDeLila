"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _lesmainsdelaterreshortcuts = require("../les-mains-de-la-terre.shortcuts");
describe('LesMainsShortcuts', ()=>{
    it('retourne un tableau', ()=>{
        expect(Array.isArray((0, _lesmainsdelaterreshortcuts.buildLesMainsDeLaTerreShortcuts)({
            metadata: {},
            currentPlayerId: 1,
            started: true
        }))).toBe(true);
    });
});
