"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _pawnsutils = require("../pawns.utils");
describe('frousse pawns utils', ()=>{
    it('resolves pawn ids from different primitive values', ()=>{
        expect((0, _pawnsutils.resolvePawnId)(null)).toBeNull();
        expect((0, _pawnsutils.resolvePawnId)(undefined)).toBeNull();
        expect((0, _pawnsutils.resolvePawnId)('  wolf  ')).toBe('wolf');
        expect((0, _pawnsutils.resolvePawnId)(42)).toBe('42');
        expect((0, _pawnsutils.resolvePawnId)(false)).toBe('false');
        expect((0, _pawnsutils.resolvePawnId)(true)).toBe('true');
        expect((0, _pawnsutils.resolvePawnId)({})).toBeNull();
        expect((0, _pawnsutils.resolvePawnId)(Number.POSITIVE_INFINITY)).toBeNull();
    });
    it('formats pawn choice labels for all branches', ()=>{
        expect((0, _pawnsutils.formatPawnChoiceLabel)({
            id: 'wolf',
            name: 'Loup',
            description: 'Rapide'
        })).toBe('Loup: Rapide');
        expect((0, _pawnsutils.formatPawnChoiceLabel)({
            id: 'fox',
            name: 'Renard'
        })).toBe('Renard');
        expect((0, _pawnsutils.formatPawnChoiceLabel)({
            id: 'ghost',
            name: '',
            description: 'Invisible'
        })).toBe('Invisible');
        expect((0, _pawnsutils.formatPawnChoiceLabel)({
            id: 'fallback-id',
            name: '',
            description: ''
        })).toBe('fallback-id');
        expect((0, _pawnsutils.formatPawnChoiceLabel)({})).toBe('Pion');
    });
});
