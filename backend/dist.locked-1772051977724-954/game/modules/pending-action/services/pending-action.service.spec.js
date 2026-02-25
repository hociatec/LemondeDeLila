"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _pendingactionservice = require("./pending-action.service");
describe('PendingActionService', ()=>{
    it('stores and returns per-player pending action', ()=>{
        const service = new _pendingactionservice.PendingActionService();
        service.set(1, {
            type: 'draw'
        });
        expect(service.get(1)).toEqual({
            type: 'draw'
        });
        expect(service.get(2)).toBeUndefined();
    });
    it('clears pending action for a player', ()=>{
        const service = new _pendingactionservice.PendingActionService();
        service.set(1, {
            type: 'draw'
        });
        service.clear(1);
        expect(service.get(1)).toBeUndefined();
    });
    it('creates and clears pending state on game state', ()=>{
        const state = {
            status: 'started',
            pending: null
        };
        const withPending = (0, _pendingactionservice.createPendingState)(state, {
            type: 'draw',
            playerId: 1,
            blocking: true
        });
        expect((0, _pendingactionservice.isPendingType)(withPending, 'draw')).toBe(true);
        const cleared = (0, _pendingactionservice.clearPendingState)(withPending);
        expect(cleared.pending).toBeNull();
    });
    it('resolves pending state then clears it', ()=>{
        const state = {
            status: 'started',
            pending: {
                type: 'choose_target',
                playerId: 1,
                blocking: true
            },
            metadata: {
                ok: true
            }
        };
        const out = (0, _pendingactionservice.resolvePendingState)(state, (next, pending)=>({
                ...next,
                metadata: {
                    ...next.metadata ?? {},
                    resolvedType: pending.type
                }
            }));
        expect(out.pending).toBeNull();
        expect(out.metadata).toMatchObject({
            ok: true,
            resolvedType: 'choose_target'
        });
    });
});
