"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _seededrng = require("./seeded-rng");
describe('seeded-rng', ()=>{
    it('keeps provided seed/counter', ()=>{
        const meta = {
            rng: {
                seed: 123,
                counter: 7
            }
        };
        expect((0, _seededrng.ensureSeededRng)(meta)).toEqual({
            seed: 123,
            counter: 7
        });
    });
    it('derives a deterministic seed from room context', ()=>{
        const meta = {
            roomId: 42,
            roomStartedAt: '2026-01-04T15:00:00.000Z',
            gameType: 'panier-express'
        };
        expect((0, _seededrng.ensureSeededRng)(meta).seed).toBe((0, _seededrng.ensureSeededRng)(meta).seed);
    });
    it('changes derived seed when startedAt changes', ()=>{
        const base = {
            roomId: 42,
            gameType: 'panier-express'
        };
        const a = (0, _seededrng.ensureSeededRng)({
            ...base,
            roomStartedAt: 'A'
        }).seed;
        const b = (0, _seededrng.ensureSeededRng)({
            ...base,
            roomStartedAt: 'B'
        }).seed;
        expect(a).not.toBe(b);
    });
    it('changes derived seed when roomRunId changes', ()=>{
        const base = {
            roomId: 42,
            roomStartedAt: '2026-01-04T15:00:00.000Z',
            gameType: 'panier-express'
        };
        const a = (0, _seededrng.ensureSeededRng)({
            ...base,
            roomRunId: 1
        }).seed;
        const b = (0, _seededrng.ensureSeededRng)({
            ...base,
            roomRunId: 2
        }).seed;
        expect(a).not.toBe(b);
    });
    it('falls back to Math.random when context missing', ()=>{
        const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
        try {
            expect((0, _seededrng.ensureSeededRng)({}).seed).toBe(2 ** 31);
        } finally{
            spy.mockRestore();
        }
    });
});
