"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _pawnmoveselectionhelper = require("./pawn-move-selection.helper");
describe('pawn-move-selection.helper', ()=>{
    it('returns normalized pending move options', ()=>{
        const pending = {
            data: {
                moves: [
                    {
                        pawnIndex: 0,
                        targetProgress: 6
                    },
                    {
                        pawnIndex: 1,
                        targetProgress: 3
                    }
                ]
            }
        };
        expect((0, _pawnmoveselectionhelper.getPendingPawnMoveOptions)(pending)).toEqual([
            {
                pawnIndex: 0,
                targetProgress: 6
            },
            {
                pawnIndex: 1,
                targetProgress: 3
            }
        ]);
    });
    it('builds move actions from pending options', ()=>{
        const pending = {
            data: {
                moves: [
                    {
                        pawnIndex: 2,
                        targetProgress: 9
                    }
                ]
            }
        };
        expect((0, _pawnmoveselectionhelper.listPendingPawnMoveActions)(pending, 'move_pawn')).toEqual([
            {
                type: 'move_pawn',
                payload: {
                    pawnIndex: 2,
                    targetProgress: 9
                }
            }
        ]);
    });
    it('resolves a valid move payload', ()=>{
        const pending = {
            data: {
                moves: [
                    {
                        pawnIndex: 2,
                        targetProgress: 9
                    }
                ]
            }
        };
        expect((0, _pawnmoveselectionhelper.resolvePendingPawnMove)(pending, {
            pawnIndex: 2,
            targetProgress: 9
        })).toEqual({
            pawnIndex: 2,
            targetProgress: 9
        });
        expect((0, _pawnmoveselectionhelper.resolvePendingPawnMove)(pending, {
            pawnIndex: 2,
            targetProgress: 8
        })).toBeNull();
    });
});
