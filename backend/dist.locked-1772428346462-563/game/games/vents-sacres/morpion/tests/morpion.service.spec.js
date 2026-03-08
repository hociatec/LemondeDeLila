"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _morpionservice = require("../morpion.service");
const _morpionpresenter = require("../morpion.presenter");
const _gridcellactionsservice = require("../../../../modules/grid/services/grid-cell-actions.service");
describe('MorpionService', ()=>{
    it('exposes playable cells only for current player', async ()=>{
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
        const exposedA = service.exposeStateForUser(state, 1);
        const exposedB = service.exposeStateForUser(state, 2);
        expect((exposedA.actions ?? []).length).toBe(9);
        expect((exposedB.actions ?? []).length).toBe(0);
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
                currentPlayerId: 2,
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
        // hydrateInitialState forces the first player as current; override for this bot-turn test.
        state.turn.currentPlayerId = 2;
        const actions = service.getBotActions(state, 2);
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
        const exposed = service.exposeStateForUser(state, 1);
        expect(exposed?.extras?.ui?.panels?.position?.message).toContain('Plateau');
        expect(exposed?.extras?.ui?.panels?.play?.message).toContain('Cases libres');
    });
});
