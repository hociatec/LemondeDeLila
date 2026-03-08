"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _morpionservice = require("../morpion.service");
const _morpionpresenter = require("../morpion.presenter");
const _gridcellactionsservice = require("../../../../modules/grid/services/grid-cell-actions.service");
describe('MorpionService', ()=>{
    it('requires pawn selection before exposing playable cells', async ()=>{
        const service = new _morpionservice.MorpionService({
            register: ()=>{}
        }, new _morpionpresenter.MorpionPresenter(new _gridcellactionsservice.GridCellActionsService()));
        let state = service.hydrateInitialState({
            status: 'started',
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
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
            log: [],
            metadata: {}
        });
        const exposedA = service.exposeStateForUser(state, 1);
        const exposedB = service.exposeStateForUser(state, 2);
        expect((exposedA.actions ?? []).length).toBe(2);
        expect((exposedB.actions ?? []).length).toBe(0);
        const choose = (actorId, pawnId)=>({
                type: 'choose_pawn',
                payload: {
                    pawnId
                },
                meta: {
                    actorId
                }
            });
        state = service.applyActions(state, [
            choose(1, 'X')
        ]);
        state = service.applyActions(state, [
            choose(2, 'O')
        ]);
        const exposedAfterSetup = service.exposeStateForUser(state, 1);
        expect((exposedAfterSetup.actions ?? []).length).toBe(9);
    });
    it('detects a winner', async ()=>{
        const service = new _morpionservice.MorpionService({
            register: ()=>{}
        }, new _morpionpresenter.MorpionPresenter(new _gridcellactionsservice.GridCellActionsService()));
        let state = service.hydrateInitialState({
            status: 'started',
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
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
            log: [],
            metadata: {}
        });
        const play = (actorId, x, y)=>({
                type: 'morpion_play',
                payload: {
                    x,
                    y
                },
                meta: {
                    actorId
                }
            });
        const choose = (actorId, pawnId)=>({
                type: 'choose_pawn',
                payload: {
                    pawnId
                },
                meta: {
                    actorId
                }
            });
        state = service.applyActions(state, [
            choose(1, 'X')
        ]);
        state = service.applyActions(state, [
            choose(2, 'O')
        ]);
        state = service.applyActions(state, [
            play(1, 0, 0)
        ]);
        state = service.applyActions(state, [
            play(2, 0, 1)
        ]);
        state = service.applyActions(state, [
            play(1, 1, 0)
        ]);
        state = service.applyActions(state, [
            play(2, 1, 1)
        ]);
        state = service.applyActions(state, [
            play(1, 2, 0)
        ]);
        expect(String(state.status)).toBe('finished');
        expect(state.metadata.winnerId).toBe(1);
    });
    it('suggests a bot move on its turn', async ()=>{
        const service = new _morpionservice.MorpionService({
            register: ()=>{}
        }, new _morpionpresenter.MorpionPresenter(new _gridcellactionsservice.GridCellActionsService()));
        const state = service.hydrateInitialState({
            status: 'started',
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'Human'
                },
                {
                    id: 2,
                    username: 'Bot',
                    isBot: true
                }
            ],
            log: [],
            metadata: {}
        });
        const choose = (actorId, pawnId)=>({
                type: 'choose_pawn',
                payload: {
                    pawnId
                },
                meta: {
                    actorId
                }
            });
        // Finish pawn selection, then force bot turn for move suggestion.
        let next = service.applyActions(state, [
            choose(1, 'X')
        ]);
        next = service.applyActions(next, [
            choose(2, 'O')
        ]);
        next.turn.currentPlayerId = 2;
        const actions = service.getBotActions(next, 2);
        expect(actions.length).toBeGreaterThan(0);
        expect(actions[0].type).toBe('morpion_play');
    });
    it('exposes ui panels for info shortcuts', async ()=>{
        const service = new _morpionservice.MorpionService({
            register: ()=>{}
        }, new _morpionpresenter.MorpionPresenter(new _gridcellactionsservice.GridCellActionsService()));
        const state = service.hydrateInitialState({
            status: 'started',
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
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
            log: [],
            metadata: {}
        });
        const choose = (actorId, pawnId)=>({
                type: 'choose_pawn',
                payload: {
                    pawnId
                },
                meta: {
                    actorId
                }
            });
        let configured = service.applyActions(state, [
            choose(1, 'X')
        ]);
        configured = service.applyActions(configured, [
            choose(2, 'O')
        ]);
        const exposed = service.exposeStateForUser(configured, 1);
        expect(exposed?.extras?.ui?.panels?.position?.message).toContain('Plateau');
        expect(exposed?.extras?.ui?.panels?.play?.message).toContain('Cases libres');
    });
});
