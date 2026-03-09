"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _pawnpendingrulebookhelper = require("./pawn-pending-rulebook.helper");
describe('pawn-pending-rulebook.helper', ()=>{
    it('returns actions only when pending belongs to player', ()=>{
        const pending = {
            type: 'choose_pawn',
            playerId: 7,
            data: {
                pawns: [
                    {
                        id: 'a',
                        label: 'A'
                    }
                ]
            }
        };
        expect((0, _pawnpendingrulebookhelper.getPendingPawnActionsForPlayer)(pending, 7, 'choose_pawn')).toEqual([
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'a'
                }
            }
        ]);
        expect((0, _pawnpendingrulebookhelper.getPendingPawnActionsForPlayer)(pending, 8, 'choose_pawn')).toEqual([]);
    });
    it('validates pending action for actor', ()=>{
        const pending = {
            type: 'choose_pawn',
            playerId: 4,
            data: {
                pawns: [
                    {
                        id: 'x',
                        label: 'X'
                    }
                ]
            }
        };
        expect((0, _pawnpendingrulebookhelper.validatePendingPawnActionForActor)({
            pending,
            actorId: 4,
            actionType: 'choose_pawn',
            payload: {
                pawnId: 'x'
            }
        })).toEqual({
            ok: true,
            pawnId: 'x',
            action: {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'x'
                }
            }
        });
        expect((0, _pawnpendingrulebookhelper.validatePendingPawnActionForActor)({
            pending,
            actorId: 5,
            actionType: 'choose_pawn',
            payload: {
                pawnId: 'x'
            }
        })).toEqual({
            ok: false,
            reason: 'not_pending_for_actor'
        });
        expect((0, _pawnpendingrulebookhelper.validatePendingPawnActionForActor)({
            pending,
            actorId: 4,
            actionType: 'roll',
            payload: {
                pawnId: 'x'
            }
        })).toEqual({
            ok: false,
            reason: 'wrong_action_type'
        });
        expect((0, _pawnpendingrulebookhelper.validatePendingPawnActionForActor)({
            pending,
            actorId: 4,
            actionType: 'choose_pawn',
            payload: {
                pawnId: 'bad'
            }
        })).toEqual({
            ok: false,
            reason: 'invalid_pawn'
        });
    });
});
