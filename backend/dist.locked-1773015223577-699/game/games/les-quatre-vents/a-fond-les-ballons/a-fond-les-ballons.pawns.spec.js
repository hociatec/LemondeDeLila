"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _afondlesballonspawns = require("./a-fond-les-ballons.pawns");
describe('a-fond-les-ballons pawns', ()=>{
    it('resolves pawn ids from id/label/object forms', ()=>{
        const first = _afondlesballonspawns.A_FOND_LES_BALLONS_PAWNS[0];
        expect((0, _afondlesballonspawns.resolvePawnId)(first.id)).toBe(first.id);
        expect((0, _afondlesballonspawns.resolvePawnId)(first.label)).toBe(first.id);
        expect((0, _afondlesballonspawns.resolvePawnId)({
            id: first.id
        })).toBe(first.id);
        expect((0, _afondlesballonspawns.resolvePawnId)({
            pawnId: first.id
        })).toBe(first.id);
        expect((0, _afondlesballonspawns.resolvePawnId)({
            value: first.label
        })).toBe(first.id);
    });
    it('handles unknown and scalar values safely', ()=>{
        expect((0, _afondlesballonspawns.resolvePawnId)(null)).toBeNull();
        expect((0, _afondlesballonspawns.resolvePawnId)(undefined)).toBeNull();
        expect((0, _afondlesballonspawns.resolvePawnId)('inconnu')).toBeNull();
        expect((0, _afondlesballonspawns.resolvePawnId)(1234)).toBeNull();
        expect((0, _afondlesballonspawns.resolvePawnId)(true)).toBeNull();
        expect((0, _afondlesballonspawns.resolvePawnId)({})).toBeNull();
    });
});
