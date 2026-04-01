"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _turnservice = require("../../../../modules/turn/services/turn.service");
const _turnpoliciesservice = require("../../../../modules/turn-policies/services/turn-policies.service");
const _zigetzagactionservice = require("../actions/zig-et-zag-action.service");
const _zigetzagsetupservice = require("../setup/zig-et-zag-setup.service");
const _randomservice = require("../../../../modules/random/services/random.service");
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
describe('ZigEtZag compat', ()=>{
    it('exposes draw_card actions even if waitingPlayers ids are serialized as strings', async ()=>{
        const service = new _zigetzagactionservice.ZigEtZagActionService(new _gamecoreservice.GameCoreService(), new _turnflowservice.TurnFlowService(new _turnservice.TurnService(), new _turnpoliciesservice.TurnPoliciesService(new _gamecoreservice.GameCoreService())), new _randomservice.RandomService());
        const state = {
            status: 'started',
            phase: 'turn',
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
            pending: null,
            metadata: {
                playerDecks: {
                    '1': [
                        'zig-1'
                    ],
                    '2': [
                        'zig-2'
                    ]
                },
                // Simule une serialisation JSON "agressive" ou stockage non typé.
                roundState: {
                    stage: 'selection',
                    plays: [
                        {
                            playerId: '1',
                            playedCards: []
                        },
                        {
                            playerId: '2',
                            playedCards: []
                        }
                    ],
                    waitingPlayers: [
                        '1',
                        '2'
                    ],
                    tiedPlayers: [],
                    triggerColors: {},
                    triggerFamilies: {},
                    battleLog: []
                },
                lastRound: null,
                winnerId: null
            }
        };
        const actions = _rulebook.getAvailableActions(state, 1);
        expect(actions.length).toBeGreaterThan(0);
        expect(actions.every((a)=>String(a?.type) === 'draw_card')).toBe(true);
        // The service should be able to apply the action even if ids are strings in the roundState.
        const after = service.applyActions(state, [
            {
                type: 'draw_card',
                payload: {},
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect((after.metadata?.playerDecks?.['1'] ?? []).length).toBe(0);
    });
    it('prefers a waiting bot as currentPlayerId on hydrateInitialState (for bot scheduling)', async ()=>{
        const setup = new _zigetzagsetupservice.ZigEtZagSetupService(new _randomservice.RandomService());
        const base = {
            status: 'started',
            phase: 'turn',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'Human',
                    isBot: false
                },
                {
                    id: -2,
                    username: 'Bot',
                    isBot: true
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            metadata: {}
        };
        const hydrated = setup.hydrateInitialState(base);
        expect(hydrated.turn?.currentPlayerId).toBe(-2);
        const messages = (hydrated.log ?? []).map((x)=>String(x?.message ?? ''));
        expect(messages).toContain("C'est au tour de Bot.");
    });
    it('enforces strict draw order and logs draw/reveal flow', async ()=>{
        const service = new _zigetzagactionservice.ZigEtZagActionService(new _gamecoreservice.GameCoreService(), new _turnflowservice.TurnFlowService(new _turnservice.TurnService(), new _turnpoliciesservice.TurnPoliciesService(new _gamecoreservice.GameCoreService())), new _randomservice.RandomService());
        const state = {
            status: 'started',
            phase: 'turn',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'Hacene'
                },
                {
                    id: 2,
                    username: 'Lila'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            metadata: {
                playerDecks: {
                    '1': [
                        'zig-1'
                    ],
                    '2': [
                        'zig-2'
                    ]
                },
                roundState: {
                    stage: 'selection',
                    plays: [
                        {
                            playerId: 1,
                            playedCards: []
                        },
                        {
                            playerId: 2,
                            playedCards: []
                        }
                    ],
                    waitingPlayers: [
                        1,
                        2
                    ],
                    tiedPlayers: [],
                    triggerColors: {},
                    triggerFamilies: {},
                    battleLog: []
                },
                lastRound: null,
                winnerId: null
            }
        };
        // Player 2 must not be allowed while player 1 is waiting first.
        expect(_rulebook.getAvailableActions(state, 2)).toEqual([]);
        const unchanged = service.applyActions(state, [
            {
                type: 'draw_card',
                payload: {},
                meta: {
                    actorId: 2
                }
            }
        ]);
        expect((unchanged.metadata?.playerDecks?.['2'] ?? []).length).toBe(1);
        const afterP1 = service.applyActions(state, [
            {
                type: 'draw_card',
                payload: {},
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect((afterP1.metadata?.playerDecks?.['1'] ?? []).length).toBe(0);
        const afterP1Messages = (afterP1.log ?? []).map((x)=>x?.message ?? '');
        expect(afterP1Messages).toContain('Hacene pioche.');
        expect(afterP1Messages).toContain("C'est au tour de Lila.");
        expect(afterP1.metadata?.roundState?.waitingPlayers).toEqual([
            2
        ]);
        const afterP2 = service.applyActions(afterP1, [
            {
                type: 'draw_card',
                payload: {},
                meta: {
                    actorId: 2
                }
            }
        ]);
        const afterP2Messages = (afterP2.log ?? []).map((x)=>x?.message ?? '');
        expect(afterP2Messages).toContain('Lila pioche.');
        expect(afterP2Messages).toContain('Hacene et Lila dévoilent leurs cartes.');
    });
    it('applies full capture count on winner deck summary (+2/-2 on a basic trick)', async ()=>{
        const service = new _zigetzagactionservice.ZigEtZagActionService(new _gamecoreservice.GameCoreService(), new _turnflowservice.TurnFlowService(new _turnservice.TurnService(), new _turnpoliciesservice.TurnPoliciesService(new _gamecoreservice.GameCoreService())), new _randomservice.RandomService());
        const state = {
            status: 'started',
            phase: 'turn',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'Lilas'
                },
                {
                    id: 2,
                    username: 'Wally Gator'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            pending: null,
            metadata: {
                playerDecks: {
                    '1': [
                        'pantoufle-loup',
                        'banane-libellule'
                    ],
                    '2': [
                        'pantoufle-poisson',
                        'dentifrice-libellule'
                    ]
                },
                roundState: {
                    stage: 'selection',
                    plays: [
                        {
                            playerId: 1,
                            playedCards: []
                        },
                        {
                            playerId: 2,
                            playedCards: []
                        }
                    ],
                    waitingPlayers: [
                        1,
                        2
                    ],
                    tiedPlayers: [],
                    triggerColors: {},
                    triggerFamilies: {},
                    battleLog: []
                },
                lastRound: null,
                winnerId: null
            }
        };
        const afterP1 = service.applyActions(state, [
            {
                type: 'select_card',
                payload: {
                    cardId: 'pantoufle-loup'
                },
                meta: {
                    actorId: 1
                }
            }
        ]);
        const afterP2 = service.applyActions(afterP1, [
            {
                type: 'select_card',
                payload: {
                    cardId: 'pantoufle-poisson'
                },
                meta: {
                    actorId: 2
                }
            }
        ]);
        expect((afterP2.metadata?.playerDecks?.['1'] ?? []).length).toBe(4);
        expect((afterP2.metadata?.playerDecks?.['2'] ?? []).length).toBe(0);
    });
});
