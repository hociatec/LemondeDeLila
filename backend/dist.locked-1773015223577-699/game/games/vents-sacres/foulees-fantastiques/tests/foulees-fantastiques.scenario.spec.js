"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _fouleesfantastiquesactionservice = require("../actions/foulees-fantastiques-action.service");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _turnservice = require("../../../../modules/turn/services/turn.service");
const _turnpoliciesservice = require("../../../../modules/turn-policies/services/turn-policies.service");
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
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
describe('FouleesFantastiques scenario', ()=>{
    it('offers roll when nothing pending', ()=>{
        const state = {
            status: 'started',
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'A'
                }
            ]
        };
        const actions = _rulebook.getAvailableActions(state, 1);
        expect(actions.map((a)=>a.type)).toContain('roll');
    });
    it('canonicalizes legacy ROLL_DICE action', ()=>{
        const state = {
            status: 'started',
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'A'
                }
            ]
        };
        const validated = _rulebook.validateAction(state, {
            type: 'ROLL_DICE',
            payload: {
                anything: true
            }
        }, 1);
        expect(validated).toEqual({
            type: 'roll',
            payload: {}
        });
    });
    it('logs family-choice prompt during setup when selection is pending', ()=>{
        const service = new _fouleesfantastiquesactionservice.FouleesFantastiquesActionService({
            rollDice: ()=>({
                    roll: 1,
                    meta: {}
                })
        }, new _turnflowservice.TurnFlowService(new _turnservice.TurnService(), new _turnpoliciesservice.TurnPoliciesService(new _gamecoreservice.GameCoreService())), new _gamecoreservice.GameCoreService(), {
            recomputeBoardView: (s)=>s
        }, new _setupflowservice.SetupFlowService());
        const state = {
            status: 'started',
            phase: 'setup',
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'Lilas'
                },
                {
                    id: 2,
                    username: 'Bucky'
                }
            ],
            log: [],
            pending: null,
            metadata: {
                familyIdByPlayer: {}
            }
        };
        const next = service.applyActions(state, [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        expect(next.pending?.type).toBe('choose_family');
        const messages = (next.log ?? []).map((x)=>String(x?.message ?? ''));
        expect(messages).toContain("Lilas doit choisir une famille d'animaux.");
    });
    it('restores the current family-choice prompt before handling the first choice', ()=>{
        const service = new _fouleesfantastiquesactionservice.FouleesFantastiquesActionService({
            rollDice: ()=>({
                    roll: 1,
                    meta: {}
                })
        }, new _turnflowservice.TurnFlowService(new _turnservice.TurnService(), new _turnpoliciesservice.TurnPoliciesService(new _gamecoreservice.GameCoreService())), new _gamecoreservice.GameCoreService(), {
            recomputeBoardView: (s)=>s
        }, new _setupflowservice.SetupFlowService());
        const state = {
            status: 'started',
            phase: 'setup',
            turnIndex: 0,
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'Clover'
                },
                {
                    id: 2,
                    username: 'Winnie'
                }
            ],
            log: [
                "C'est au tour de Clover."
            ].map((message)=>({
                    message
                })),
            pending: {
                type: 'choose_family',
                playerId: 1,
                blocking: true,
                choices: [
                    'Famille des Equides (ecurie)',
                    'Famille des Primates (primaterie)'
                ],
                data: {
                    familyIds: [
                        'equides',
                        'primates'
                    ]
                }
            },
            metadata: {
                familyIdByPlayer: {},
                familyByPlayer: {},
                habitatByPlayer: {},
                pawnNamesByPlayer: {}
            }
        };
        const next = service.applyActions(state, [
            {
                type: 'choose_family',
                payload: {
                    familyId: 'equides'
                }
            }
        ]);
        const messages = (next.log ?? []).map((x)=>String(x?.message ?? ''));
        expect(messages).toContain("Clover doit choisir une famille d'animaux.");
        expect(messages).toContain('Clover choisit la famille des Equides (ecurie).');
    });
    it('announces next player after ending a turn without moves', ()=>{
        const service = new _fouleesfantastiquesactionservice.FouleesFantastiquesActionService({
            rollDice: ()=>({
                    roll: 1,
                    meta: {}
                })
        }, new _turnflowservice.TurnFlowService(new _turnservice.TurnService(), new _turnpoliciesservice.TurnPoliciesService(new _gamecoreservice.GameCoreService())), new _gamecoreservice.GameCoreService(), {
            recomputeBoardView: (s)=>s
        }, new _setupflowservice.SetupFlowService());
        const state = {
            status: 'started',
            phase: 'turn',
            turnIndex: 0,
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'Lilas'
                },
                {
                    id: 2,
                    username: 'Bucky'
                }
            ],
            log: [],
            pending: null,
            metadata: {
                trackLength: 40,
                homeLength: 4,
                offsets: {
                    1: 0,
                    2: 20
                },
                safeTiles: [
                    0,
                    20
                ],
                pawnsByPlayer: {
                    1: [
                        {
                            pawnIndex: 0,
                            progress: -1
                        },
                        {
                            pawnIndex: 1,
                            progress: -1
                        },
                        {
                            pawnIndex: 2,
                            progress: -1
                        },
                        {
                            pawnIndex: 3,
                            progress: -1
                        }
                    ],
                    2: [
                        {
                            pawnIndex: 0,
                            progress: -1
                        },
                        {
                            pawnIndex: 1,
                            progress: -1
                        },
                        {
                            pawnIndex: 2,
                            progress: -1
                        },
                        {
                            pawnIndex: 3,
                            progress: -1
                        }
                    ]
                },
                statuses: {
                    skipTurn: {}
                }
            }
        };
        const next = service.applyActions(state, [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        expect(next.turn?.currentPlayerId).toBe(2);
        const messages = (next.log ?? []).map((x)=>String(x?.message ?? ''));
        expect(messages).toContain("C'est au tour de Bucky.");
    });
});
