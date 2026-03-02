"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _pawnselectionhelper = require("./pawn-selection.helper");
describe('pawn-selection.helper', ()=>{
    it('resolves from pending.data.pawns with pawnId payload', ()=>{
        const pending = {
            type: 'pick_pawn',
            playerId: 3,
            data: {
                pawns: [
                    {
                        id: 'Le Lutin',
                        label: 'Le Lutin: Agile'
                    }
                ]
            }
        };
        expect((0, _pawnselectionhelper.resolvePendingPawnId)(pending, {
            pawnId: 'Le Lutin'
        })).toBe('Le Lutin');
    });
    it('builds generic pending pawn actions', ()=>{
        const pending = {
            type: 'choose_pawn',
            data: {
                pawns: [
                    {
                        id: 'A'
                    },
                    {
                        id: 'B'
                    }
                ]
            }
        };
        expect((0, _pawnselectionhelper.listPendingPawnActions)(pending, 'choose_pawn')).toEqual([
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'A'
                }
            },
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'B'
                }
            }
        ]);
    });
    it('checks pending player identity', ()=>{
        const pending = {
            type: 'choose_pawn',
            playerId: '7'
        };
        expect((0, _pawnselectionhelper.isPendingPawnForPlayer)(pending, 7, 'choose_pawn')).toBe(true);
        expect((0, _pawnselectionhelper.isPendingPawnForPlayer)(pending, 8, 'choose_pawn')).toBe(false);
    });
    it('returns normalized options', ()=>{
        const pending = {
            data: {
                pawns: [
                    {
                        id: 'X',
                        label: 'X label'
                    }
                ]
            }
        };
        expect((0, _pawnselectionhelper.getPendingPawnOptions)(pending)).toEqual([
            {
                id: 'X',
                label: 'X label'
            }
        ]);
    });
});
