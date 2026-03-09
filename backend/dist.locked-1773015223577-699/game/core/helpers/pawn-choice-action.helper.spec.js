"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _pawnchoiceactionhelper = require("./pawn-choice-action.helper");
describe('resolvePendingPawnChoiceAction', ()=>{
    it('returns null when pending type does not match', ()=>{
        const result = (0, _pawnchoiceactionhelper.resolvePendingPawnChoiceAction)({
            state: {
                pending: {
                    type: 'draw',
                    playerId: 2,
                    data: {
                        pawns: []
                    }
                }
            },
            action: {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'a'
                }
            },
            resolveChoice: ()=>({
                    id: 'a'
                })
        });
        expect(result).toBeNull();
    });
    it('resolves playerId, options and chosen pawn', ()=>{
        const options = [
            {
                id: 'a',
                label: 'A'
            }
        ];
        const result = (0, _pawnchoiceactionhelper.resolvePendingPawnChoiceAction)({
            state: {
                pending: {
                    type: 'choose_pawn',
                    playerId: 2,
                    data: {
                        pawns: options
                    }
                }
            },
            action: {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'a'
                }
            },
            resolveChoice: (raw, opts)=>String(raw) === 'a' && opts.length === 1 ? {
                    id: 'a',
                    label: 'A'
                } : null
        });
        expect(result).toEqual({
            playerId: 2,
            options,
            chosen: {
                id: 'a',
                label: 'A'
            },
            pending: {
                type: 'choose_pawn',
                playerId: 2,
                data: {
                    pawns: options
                }
            }
        });
    });
    it('falls back to turn.currentPlayerId when pending.playerId is invalid', ()=>{
        const result = (0, _pawnchoiceactionhelper.resolvePendingPawnChoiceAction)({
            state: {
                turn: {
                    currentPlayerId: 5
                },
                pending: {
                    type: 'pick_pawn',
                    playerId: 'x',
                    data: {
                        pawns: [
                            {
                                id: 'b',
                                label: 'B'
                            }
                        ]
                    }
                }
            },
            action: {
                type: 'pick_pawn',
                payload: {
                    value: 'b'
                }
            },
            pendingType: 'pick_pawn',
            resolveChoice: (raw)=>String(raw) === 'b' ? {
                    id: 'b'
                } : null
        });
        expect(result?.playerId).toBe(5);
        expect(result?.chosen).toEqual({
            id: 'b'
        });
    });
});
