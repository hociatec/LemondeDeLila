"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _caactionsservice = require("./ca-actions.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _turnservice = require("../../../../modules/turn/services/turn.service");
const _turnpoliciesservice = require("../../../../modules/turn-policies/services/turn-policies.service");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _casetup = require("../setup/ca.setup");
describe('Ça Dérape ! - action flow', ()=>{
    function makeService(rolls) {
        const random = {
            rollDice: jest.fn((meta)=>{
                const roll = rolls.length ? rolls.shift() : 1;
                return {
                    roll,
                    meta
                };
            }),
            shuffle: jest.fn((meta, values)=>({
                    values,
                    meta
                }))
        };
        const core = new _gamecoreservice.GameCoreService();
        const turns = new _turnflowservice.TurnFlowService(new _turnservice.TurnService(), new _turnpoliciesservice.TurnPoliciesService(core));
        const deckPolicies = new _deckpoliciesservice.DeckPoliciesService(random);
        return new _caactionsservice.CaActionService(random, turns, core, deckPolicies);
    }
    function makeStartedState() {
        const base = {
            status: 'started',
            phase: 'playing',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'A'
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            metadata: {},
            pending: null,
            botThinking: false
        };
        return new _casetup.CaSetupService().hydrateInitialState(base);
    }
    it('does not require a draw on neutral tiles, and advances the turn after roll', ()=>{
        // Roll 2: from start (case 1) -> case 3 (neutral).
        const svc = makeService([
            2
        ]);
        const state = makeStartedState();
        const next = svc.applyActions(state, [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        expect(next.pending).toBeNull();
        expect(next.turn?.currentPlayerId).toBe(2);
    });
    it('requires a draw on non-neutral tiles after roll', ()=>{
        // Roll 1: from start (case 1) -> case 2 (non-neutral).
        const svc = makeService([
            1
        ]);
        const state = makeStartedState();
        const next = svc.applyActions(state, [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        expect(next.pending?.type).toBe('draw');
        expect(next.pending?.playerId).toBe(1);
        // Turn stays on the same player until draw resolves.
        expect(next.turn?.currentPlayerId).toBe(1);
    });
    it('advances to next player after resolving a drawn card', ()=>{
        // Roll 1 lands on a card tile, then draw resolves and turn advances.
        const svc = makeService([
            1
        ]);
        const state = makeStartedState();
        const rolled = svc.applyActions(state, [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        expect(rolled.pending?.type).toBe('draw');
        const afterDraw = svc.applyActions(rolled, [
            {
                type: 'draw',
                payload: {}
            }
        ]);
        expect(afterDraw.pending).toBeNull();
        expect(afterDraw.turn?.currentPlayerId).toBe(2);
    });
});
