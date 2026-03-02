"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _interactiveexchangeservice = require("./interactive-exchange.service");
const _randomservice = require("../../random/services/random.service");
function makeState() {
    return {
        status: 'started',
        phase: 'main',
        round: 1,
        turnIndex: 0,
        lastRoll: null,
        log: [],
        players: [
            {
                id: 1,
                username: 'A',
                inventory: [
                    'pomme'
                ]
            },
            {
                id: 2,
                username: 'B',
                inventory: [
                    'poire'
                ]
            }
        ],
        pending: null,
        metadata: {
            roomId: 'room-1',
            roomStartedAt: '2026-02-17T00:00:00.000Z'
        }
    };
}
function adapter() {
    return {
        listTargets: (state, playerId)=>(state.players ?? []).filter((p)=>p.id !== playerId).map((p)=>({
                    targetPlayerId: p.id,
                    targetUsername: p.username
                })),
        getInventory: (state, playerId)=>{
            const player = (state.players ?? []).find((p)=>p.id === playerId);
            const inventory = Array.isArray(player?.inventory) ? player.inventory : [];
            return inventory.map((v)=>String(v));
        },
        removeFromInventory: (state, playerId, card)=>{
            const players = (state.players ?? []).map((p)=>{
                if (p.id !== playerId) return p;
                const inventory = Array.isArray(p.inventory) ? [
                    ...p.inventory
                ] : [];
                const idx = inventory.findIndex((v)=>String(v) === card);
                if (idx >= 0) inventory.splice(idx, 1);
                return {
                    ...p,
                    inventory
                };
            });
            return {
                ...state,
                players
            };
        },
        addCardToPlayer: (state, playerId, card)=>{
            const players = (state.players ?? []).map((p)=>{
                if (p.id !== playerId) return p;
                const inventory = Array.isArray(p.inventory) ? [
                    ...p.inventory
                ] : [];
                inventory.push(card);
                return {
                    ...p,
                    inventory
                };
            });
            return {
                ...state,
                players
            };
        }
    };
}
describe('InteractiveExchangeService', ()=>{
    let service;
    beforeEach(()=>{
        service = new _interactiveexchangeservice.InteractiveExchangeService(new _randomservice.RandomService());
    });
    it('marks exchange pending as blocking at start', ()=>{
        const result = service.start(makeState(), 1, 'echange-amiable', adapter());
        expect(result.kind).toBe('started');
        if (result.kind !== 'started') return;
        expect(result.pending.blocking).toBe(true);
        expect(result.state.pending?.blocking).toBe(true);
    });
    it('keeps blocking flag when choosing target', ()=>{
        const started = service.start(makeState(), 1, 'echange-amiable', adapter());
        expect(started.kind).toBe('started');
        if (started.kind !== 'started') return;
        const updated = service.chooseTarget(started.state, 1, 2, adapter());
        expect(updated.kind).toBe('updated');
        if (updated.kind !== 'updated') return;
        expect(updated.pending.blocking).toBe(true);
        expect(updated.state.pending?.blocking).toBe(true);
    });
    it('keeps blocking flag on confirm step', ()=>{
        const started = service.start(makeState(), 1, 'echange-amiable', adapter());
        expect(started.kind).toBe('started');
        if (started.kind !== 'started') return;
        const updated = service.chooseTarget(started.state, 1, 2, adapter());
        expect(updated.kind).toBe('updated');
        if (updated.kind !== 'updated') return;
        const offered = service.chooseGive(updated.state, 1, 'pomme', adapter());
        expect(offered.kind).toBe('offered');
        if (offered.kind !== 'offered') return;
        expect(offered.offer.blocking).toBe(true);
        expect(offered.state.pending?.blocking).toBe(true);
        expect(offered.state.pending?.playerId).toBe(2);
    });
});
