"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _morpionservice = require("../morpion.service");
const _morpionpresenter = require("../morpion.presenter");
const _gridcellactionsservice = require("../../../../modules/grid/services/grid-cell-actions.service");
const _morpionpawns = require("../definitions/morpion.pawns");
describe('MorpionService', ()=>{
    it('starts pawn selection with a human even if a bot is first', async ()=>{
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
                    username: 'Bot',
                    isBot: true
                },
                {
                    id: 2,
                    username: 'Human'
                }
            ],
            log: [],
            metadata: {}
        });
        expect(state.pending?.type).toBe('choose_pawn');
        expect(state.pending?.playerId).toBe(2);
        expect(state.turn?.currentPlayerId).toBe(2);
    });
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
        const chooserId = state.pending?.playerId ?? null;
        expect([
            1,
            2
        ]).toContain(chooserId);
        const otherId = chooserId === 1 ? 2 : 1;
        const exposedChooser = service.exposeStateForUser(state, chooserId);
        const exposedOther = service.exposeStateForUser(state, otherId);
        expect((exposedChooser.actions ?? []).length).toBe(_morpionpawns.MORPION_PAWNS.length);
        expect((exposedOther.actions ?? []).length).toBe(0);
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
            choose(chooserId, _morpionpawns.MORPION_PAWNS[0].id)
        ]);
        state = service.applyActions(state, [
            choose(otherId, _morpionpawns.MORPION_PAWNS[1].id)
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
        const chooserId = state.pending?.playerId ?? 1;
        const otherId = chooserId === 1 ? 2 : 1;
        state = service.applyActions(state, [
            choose(chooserId, _morpionpawns.MORPION_PAWNS[0].id)
        ]);
        state = service.applyActions(state, [
            choose(otherId, _morpionpawns.MORPION_PAWNS[1].id)
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
    it('logs correct cell refs (A1..C3) with inverted rows', async ()=>{
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
        const choose = (actorId, pawnId)=>({
                type: 'choose_pawn',
                payload: {
                    pawnId
                },
                meta: {
                    actorId
                }
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
        const chooserId = state.pending?.playerId ?? 1;
        const otherId = chooserId === 1 ? 2 : 1;
        state = service.applyActions(state, [
            choose(chooserId, _morpionpawns.MORPION_PAWNS[0].id)
        ]);
        state = service.applyActions(state, [
            choose(otherId, _morpionpawns.MORPION_PAWNS[1].id)
        ]);
        const expected = [
            [
                0,
                0,
                'A3'
            ],
            [
                1,
                0,
                'B3'
            ],
            [
                2,
                0,
                'C3'
            ],
            [
                0,
                1,
                'A2'
            ],
            [
                1,
                1,
                'B2'
            ],
            [
                2,
                1,
                'C2'
            ],
            [
                0,
                2,
                'A1'
            ],
            [
                1,
                2,
                'B1'
            ],
            [
                2,
                2,
                'C1'
            ]
        ];
        for (const [x, y, cellRef] of expected){
            const base = {
                ...state,
                status: 'started',
                pending: null,
                log: [],
                metadata: {
                    ...state.metadata ?? {},
                    board: Array.from({
                        length: 9
                    }, ()=>0),
                    winnerId: null,
                    draw: false
                }
            };
            const next = service.applyActions(base, [
                play(1, x, y)
            ]);
            const last = next.log?.[next.log.length - 1]?.message ?? '';
            expect(String(last)).toContain(` en ${cellRef}.`);
        }
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
        // Bot pawns are auto-assigned. Finish human pawn selection, then force bot turn for move suggestion.
        const next = service.applyActions(state, [
            choose(1, _morpionpawns.MORPION_PAWNS[0].id)
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
        const chooserId = state.pending?.playerId ?? 1;
        const otherId = chooserId === 1 ? 2 : 1;
        let configured = service.applyActions(state, [
            choose(chooserId, _morpionpawns.MORPION_PAWNS[0].id)
        ]);
        configured = service.applyActions(configured, [
            choose(otherId, _morpionpawns.MORPION_PAWNS[1].id)
        ]);
        const exposed = service.exposeStateForUser(configured, 1);
        expect(exposed?.extras?.ui?.panels?.position?.message).toContain('Plateau');
        expect(exposed?.extras?.ui?.panels?.play?.message).toContain('Cases libres');
    });
});
