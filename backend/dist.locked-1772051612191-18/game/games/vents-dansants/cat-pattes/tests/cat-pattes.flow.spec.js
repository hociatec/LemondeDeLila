"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _testing = require("@nestjs/testing");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _catpattesactionservice = require("../actions/cat-pattes-action.service");
const _catpattessetupservice = require("../setup/cat-pattes-setup.service");
const _catpattespresenterservice = require("../presenter/cat-pattes-presenter.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function baseState() {
    return {
        status: 'started',
        phase: 'turn',
        round: 1,
        turnIndex: 0,
        lastRoll: null,
        log: [],
        players: [
            {
                id: 1,
                username: 'Hacene',
                isBot: false
            },
            {
                id: 2,
                username: 'Lilas',
                isBot: false
            }
        ],
        turn: {
            currentPlayerId: 1,
            direction: 1
        },
        metadata: {
            gameType: 'cat-pattes',
            roomStartedAt: '2026-02-13T00:00:00.000Z',
            roomRunId: 1,
            rng: {
                seed: 123,
                counter: 0
            }
        },
        botThinking: false
    };
}
describe('CatPattes flow', ()=>{
    it('lets human choose pawn before bot auto-assignment', async ()=>{
        const moduleRef = await _testing.Test.createTestingModule({
            providers: [
                _gamecoreservice.GameCoreService,
                _randomservice.RandomService,
                _setupflowservice.SetupFlowService,
                _deckpoliciesservice.DeckPoliciesService,
                _catpattessetupservice.CatPattesSetupService,
                {
                    provide: 'TurnFlowService',
                    useValue: {
                        advanceTurn: (state)=>state
                    }
                },
                {
                    provide: _catpattesactionservice.CatPattesActionService,
                    useFactory: (core, turns, setupFlow, deckPolicies, random)=>new _catpattesactionservice.CatPattesActionService(core, turns, setupFlow, deckPolicies, random),
                    inject: [
                        _gamecoreservice.GameCoreService,
                        'TurnFlowService',
                        _setupflowservice.SetupFlowService,
                        _deckpoliciesservice.DeckPoliciesService,
                        _randomservice.RandomService
                    ]
                }
            ]
        }).compile();
        const setup = moduleRef.get(_catpattessetupservice.CatPattesSetupService);
        const actionSvc = moduleRef.get(_catpattesactionservice.CatPattesActionService);
        const seeded = baseState();
        seeded.players = [
            {
                id: 1,
                username: 'Lilas',
                isBot: false
            },
            {
                id: 2,
                username: 'Botou',
                isBot: true
            }
        ];
        seeded.turn = {
            currentPlayerId: 2,
            direction: 1
        };
        let state = setup.hydrateInitialState(seeded);
        expect(state.pending?.type).toBe('choose_pawn');
        expect(state.pending?.playerId).toBe(1);
        state = actionSvc.applyActions(state, [
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'Maine Coon'
                }
            }
        ]);
        const meta = state.metadata ?? {};
        expect(String(meta.pawnByPlayerId?.[1] ?? '')).toBe('Maine Coon');
        expect(String(meta.pawnByPlayerId?.[2] ?? '').length).toBeGreaterThan(0);
    });
    it('requires pawn selection before draw/play', async ()=>{
        const moduleRef = await _testing.Test.createTestingModule({
            providers: [
                _gamecoreservice.GameCoreService,
                _randomservice.RandomService,
                _setupflowservice.SetupFlowService,
                _deckpoliciesservice.DeckPoliciesService,
                _catpattessetupservice.CatPattesSetupService,
                {
                    provide: 'TurnFlowService',
                    useValue: {
                        advanceTurn: (state)=>{
                            const players = Array.isArray(state.players) ? state.players : [];
                            const currentId = state.turn?.currentPlayerId ?? null;
                            const idx = players.findIndex((p)=>p?.id === currentId);
                            const nextIdx = idx >= 0 ? (idx + 1) % players.length : 0;
                            return {
                                ...state,
                                turnIndex: nextIdx,
                                turn: {
                                    ...state.turn ?? {
                                        direction: 1
                                    },
                                    currentPlayerId: players[nextIdx]?.id ?? currentId,
                                    direction: 1
                                }
                            };
                        }
                    }
                },
                {
                    provide: _catpattesactionservice.CatPattesActionService,
                    useFactory: (core, turns, setupFlow, deckPolicies, random)=>new _catpattesactionservice.CatPattesActionService(core, turns, setupFlow, deckPolicies, random),
                    inject: [
                        _gamecoreservice.GameCoreService,
                        'TurnFlowService',
                        _setupflowservice.SetupFlowService,
                        _deckpoliciesservice.DeckPoliciesService,
                        _randomservice.RandomService
                    ]
                }
            ]
        }).compile();
        const setup = moduleRef.get(_catpattessetupservice.CatPattesSetupService);
        const actionsService = moduleRef.get(_catpattesactionservice.CatPattesActionService);
        let state = setup.hydrateInitialState(baseState());
        expect(state.pending?.type).toBe('choose_pawn');
        const actionsP1 = _rulebook.getAvailableActions(state, 1);
        expect(actionsP1.every((a)=>a.type === 'choose_pawn')).toBe(true);
        state = actionsService.applyActions(state, [
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'Maine Coon'
                }
            },
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'Siamois'
                }
            }
        ]);
        expect(state.pending).toBeNull();
        const messages = (state.log ?? []).map((e)=>String(e?.message ?? ''));
        expect(messages.some((m)=>/D.+but de partie: .* commence\./i.test(m))).toBe(true);
        expect(messages.some((m)=>/C'est au tour de .+\./.test(m))).toBe(true);
        const afterSelectionActions = _rulebook.getAvailableActions(state, 1);
        expect(afterSelectionActions).toEqual([
            {
                type: 'draw',
                payload: {}
            }
        ]);
    });
    it('draws to seven then returns to six after playing one card', async ()=>{
        const moduleRef = await _testing.Test.createTestingModule({
            providers: [
                _gamecoreservice.GameCoreService,
                _randomservice.RandomService,
                _setupflowservice.SetupFlowService,
                _deckpoliciesservice.DeckPoliciesService,
                _catpattessetupservice.CatPattesSetupService,
                {
                    provide: 'TurnFlowService',
                    useValue: {
                        advanceTurn: (state)=>{
                            const players = Array.isArray(state.players) ? state.players : [];
                            const currentId = state.turn?.currentPlayerId ?? null;
                            const idx = players.findIndex((p)=>p?.id === currentId);
                            const nextIdx = idx >= 0 ? (idx + 1) % players.length : 0;
                            return {
                                ...state,
                                turnIndex: nextIdx,
                                turn: {
                                    ...state.turn ?? {
                                        direction: 1
                                    },
                                    currentPlayerId: players[nextIdx]?.id ?? currentId,
                                    direction: 1
                                }
                            };
                        }
                    }
                },
                {
                    provide: _catpattesactionservice.CatPattesActionService,
                    useFactory: (core, turns, setupFlow, deckPolicies, random)=>new _catpattesactionservice.CatPattesActionService(core, turns, setupFlow, deckPolicies, random),
                    inject: [
                        _gamecoreservice.GameCoreService,
                        'TurnFlowService',
                        _setupflowservice.SetupFlowService,
                        _deckpoliciesservice.DeckPoliciesService,
                        _randomservice.RandomService
                    ]
                }
            ]
        }).compile();
        const setup = moduleRef.get(_catpattessetupservice.CatPattesSetupService);
        const actionsService = moduleRef.get(_catpattesactionservice.CatPattesActionService);
        let state = setup.hydrateInitialState(baseState());
        state = actionsService.applyActions(state, [
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'Maine Coon'
                }
            },
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'Siamois'
                }
            }
        ]);
        const meta0 = state.metadata ?? {};
        const beforeCount = Array.isArray(meta0.hands?.[1]) ? meta0.hands[1].length : 0;
        expect(beforeCount).toBe(6);
        state = actionsService.applyActions(state, [
            {
                type: 'draw',
                payload: {}
            }
        ]);
        const meta1 = state.metadata ?? {};
        const drawnCount = Array.isArray(meta1.hands?.[1]) ? meta1.hands[1].length : 0;
        expect(drawnCount).toBe(7);
        const available = _rulebook.getAvailableActions(state, 1);
        const play = available.find((a)=>a.type === 'play_card');
        expect(play).toBeDefined();
        state = actionsService.applyActions(state, [
            play
        ]);
        const meta2 = state.metadata ?? {};
        const afterPlayCount = Array.isArray(meta2.hands?.[1]) ? meta2.hands[1].length : 0;
        expect(afterPlayCount).toBe(6);
        expect(state.turn?.currentPlayerId).toBe(2);
    });
    it('does not block the game when a player draws with an empty deck and empty hand', async ()=>{
        const moduleRef = await _testing.Test.createTestingModule({
            providers: [
                _gamecoreservice.GameCoreService,
                _randomservice.RandomService,
                _setupflowservice.SetupFlowService,
                _deckpoliciesservice.DeckPoliciesService,
                _catpattessetupservice.CatPattesSetupService,
                {
                    provide: 'TurnFlowService',
                    useValue: {
                        advanceTurn: (state)=>{
                            const players = Array.isArray(state.players) ? state.players : [];
                            const currentId = state.turn?.currentPlayerId ?? null;
                            const idx = players.findIndex((p)=>p?.id === currentId);
                            const nextIdx = idx >= 0 ? (idx + 1) % players.length : 0;
                            return {
                                ...state,
                                turnIndex: nextIdx,
                                turn: {
                                    ...state.turn ?? {
                                        direction: 1
                                    },
                                    currentPlayerId: players[nextIdx]?.id ?? currentId,
                                    direction: 1
                                }
                            };
                        }
                    }
                },
                {
                    provide: _catpattesactionservice.CatPattesActionService,
                    useFactory: (core, turns, setupFlow, deckPolicies, random)=>new _catpattesactionservice.CatPattesActionService(core, turns, setupFlow, deckPolicies, random),
                    inject: [
                        _gamecoreservice.GameCoreService,
                        'TurnFlowService',
                        _setupflowservice.SetupFlowService,
                        _deckpoliciesservice.DeckPoliciesService,
                        _randomservice.RandomService
                    ]
                }
            ]
        }).compile();
        const setup = moduleRef.get(_catpattessetupservice.CatPattesSetupService);
        const actionsService = moduleRef.get(_catpattesactionservice.CatPattesActionService);
        let state = setup.hydrateInitialState(baseState());
        state = actionsService.applyActions(state, [
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'Maine Coon'
                }
            },
            {
                type: 'choose_pawn',
                payload: {
                    pawnId: 'Siamois'
                }
            }
        ]);
        const meta = {
            ...state.metadata ?? {}
        };
        meta.deck = [];
        meta.discard = [];
        meta.hands = {
            ...meta.hands ?? {},
            1: []
        };
        meta.drawnPlayerId = null;
        state = {
            ...state,
            metadata: meta,
            turn: {
                ...state.turn ?? {
                    direction: 1
                },
                currentPlayerId: 1,
                direction: 1
            },
            turnIndex: 0
        };
        const actionsBefore = _rulebook.getAvailableActions(state, 1);
        expect(actionsBefore).toEqual([
            {
                type: 'draw',
                payload: {}
            }
        ]);
        const actionsWhenDrawn = _rulebook.getAvailableActions({
            ...state,
            metadata: {
                ...state.metadata,
                drawnPlayerId: 1
            }
        }, 1);
        expect(actionsWhenDrawn).toEqual([
            {
                type: 'pass',
                payload: {}
            }
        ]);
        state = actionsService.applyActions(state, [
            {
                type: 'draw',
                payload: {}
            }
        ]);
        expect(state.metadata?.drawnPlayerId ?? null).toBeNull();
        expect(state.turn?.currentPlayerId).toBe(2);
        const messages = (state.log ?? []).map((e)=>String(e?.message ?? ''));
        expect(messages.some((m)=>/ne peut plus piocher/i.test(m))).toBe(true);
        expect(messages.some((m)=>/passe son tour/i.test(m))).toBe(true);
    });
    it('exposes choose_pawn pending choices to the current user', async ()=>{
        const moduleRef = await _testing.Test.createTestingModule({
            providers: [
                _gamecoreservice.GameCoreService,
                _randomservice.RandomService,
                _setupflowservice.SetupFlowService,
                _deckpoliciesservice.DeckPoliciesService,
                _catpattessetupservice.CatPattesSetupService
            ]
        }).compile();
        const setup = moduleRef.get(_catpattessetupservice.CatPattesSetupService);
        const presenter = new _catpattespresenterservice.CatPattesPresenterService();
        const state = setup.hydrateInitialState(baseState());
        const exposed = presenter.exposeStateForUser(state, 1);
        expect(exposed.pending?.type).toBe('choose_pawn');
        expect(Array.isArray(exposed.pending?.choices)).toBe(true);
        expect((exposed.pending?.choices ?? []).length).toBeGreaterThan(0);
        const actions = Array.isArray(exposed.actions) ? exposed.actions : [];
        expect(actions.length).toBeGreaterThan(0);
        expect(actions.every((a)=>String(a?.type ?? '') === 'choose_pawn')).toBe(true);
    });
});
