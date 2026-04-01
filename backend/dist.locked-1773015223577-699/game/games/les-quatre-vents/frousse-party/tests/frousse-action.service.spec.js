"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
const _boardeffectspoliciesservice = require("../../../../modules/board-effects-policies/services/board-effects-policies.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _turnpoliciesservice = require("../../../../modules/turn-policies/services/turn-policies.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _turnservice = require("../../../../modules/turn/services/turn.service");
const _frousseactionservice = require("../actions/frousse-action.service");
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
function buildRealTurnService(randomOverrides = {}) {
    const core = new _gamecoreservice.GameCoreService();
    const random = {
        rollDice: jest.fn(()=>({
                roll: 1,
                meta: {}
            })),
        nextInt: jest.fn(()=>({
                value: 0,
                meta: {}
            })),
        pickOne: jest.fn(()=>({
                value: null,
                meta: {}
            })),
        shuffle: jest.fn((_meta, values)=>({
                values,
                meta: {}
            })),
        ...randomOverrides
    };
    const turns = new _turnflowservice.TurnFlowService(new _turnservice.TurnService(), new _turnpoliciesservice.TurnPoliciesService(core));
    return {
        random,
        service: new _frousseactionservice.FrousseActionService(random, turns, core, new _setupflowservice.SetupFlowService(), new _boardeffectspoliciesservice.BoardEffectsPoliciesService(), new _deckpoliciesservice.DeckPoliciesService(random))
    };
}
function buildFrousseMeta(overrides = {}) {
    return {
        positions: {
            1: 0,
            2: 0
        },
        statuses: {
            skipTurn: {},
            blocked: {},
            nextMoveCap: {},
            nextRollIfThreeBackTwo: {},
            nextRollKeepLowest: {},
            nextRollMalus: {},
            nextRollDouble: {},
            ignoreTrapUntilNextDraw: {},
            ignoreNextGhost: {},
            ignoreNextPrank: {},
            ignoreNextTrap: {}
        },
        tiles: [
            {
                n: 1,
                type: 'normal',
                title: 'Entree du manoir',
                label: 'case 1. Entree du manoir (case neutre)',
                description: ''
            },
            {
                n: 2,
                type: 'normal',
                title: 'Vestibule',
                label: 'case 2. Vestibule (case neutre)',
                description: ''
            },
            {
                n: 3,
                type: 'normal',
                title: 'Couloir silencieux',
                label: 'case 3. Couloir silencieux (case neutre)',
                description: ''
            }
        ],
        pawns: [
            {
                id: 'balai-farceur',
                name: 'Balai farceur'
            },
            {
                id: 'citrouille-rigolote',
                name: 'Citrouille rigolote'
            }
        ],
        decks: {
            cards: [],
            discard: []
        },
        ...overrides
    };
}
function buildTurnState(overrides = {}) {
    return {
        status: 'started',
        turnIndex: 0,
        turn: {
            currentPlayerId: 1,
            direction: 1
        },
        players: [
            {
                id: 1,
                username: 'Lilas',
                pawn: 'balai-farceur',
                pawnLabel: 'Un balai farceur'
            },
            {
                id: 2,
                username: 'Hacene',
                pawn: 'citrouille-rigolote',
                pawnLabel: 'Une citrouille rigolote'
            }
        ],
        pending: null,
        metadata: buildFrousseMeta(),
        log: [],
        extras: {},
        ...overrides
    };
}
describe('FrousseActionService movement effects', ()=>{
    it('applies combined move effects (advance then back) as a net delta', ()=>{
        const random = {
            rollDice: jest.fn(()=>({
                    roll: 1,
                    meta: {}
                })),
            nextInt: jest.fn(()=>({
                    value: 0,
                    meta: {}
                })),
            pickOne: jest.fn(()=>({
                    value: null,
                    meta: {}
                })),
            shuffle: jest.fn((_meta, values)=>({
                    values,
                    meta: {}
                }))
        };
        const turns = {
            advanceTurn: jest.fn((state)=>state)
        };
        const core = {
            appendLog: jest.fn((state, message)=>({
                    ...state,
                    log: [
                        ...Array.isArray(state.log) ? state.log : [],
                        {
                            message
                        }
                    ]
                }))
        };
        const service = new _frousseactionservice.FrousseActionService(random, turns, core, new _setupflowservice.SetupFlowService(), new _boardeffectspoliciesservice.BoardEffectsPoliciesService(), new _deckpoliciesservice.DeckPoliciesService(random));
        const state = {
            status: 'started',
            turnIndex: 0,
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'hacene'
                }
            ],
            pending: {
                type: 'draw',
                playerId: 1,
                blocking: true
            },
            metadata: {
                positions: {
                    1: 11
                },
                statuses: {
                    skipTurn: {},
                    blocked: {},
                    nextMoveCap: {},
                    nextRollIfThreeBackTwo: {},
                    nextRollKeepLowest: {},
                    nextRollMalus: {},
                    nextRollDouble: {},
                    ignoreTrapUntilNextDraw: {},
                    ignoreNextGhost: {},
                    ignoreNextPrank: {},
                    ignoreNextTrap: {}
                },
                tiles: [],
                decks: {
                    cards: [
                        {
                            category: 'Fantôme',
                            localNumber: 999,
                            text: 'Le fantôme surgit en hurlant.\nAvancez de 5 cases puis reculez de 3.'
                        }
                    ],
                    discard: []
                }
            },
            log: [],
            extras: {}
        };
        const next = service.applyActions(state, [
            {
                type: 'draw',
                payload: {}
            }
        ]);
        const meta = next.metadata ?? {};
        // 12 -> +5 -> 17 -> -3 -> 14 (index 13)
        expect(meta.positions?.[1]).toBe(13);
    });
    it('logs conditional "roll 3 => back 2" effect as a simple instruction', ()=>{
        const random = {
            rollDice: jest.fn(()=>({
                    roll: 3,
                    meta: {}
                })),
            nextInt: jest.fn(()=>({
                    value: 0,
                    meta: {}
                })),
            pickOne: jest.fn(()=>({
                    value: null,
                    meta: {}
                })),
            shuffle: jest.fn((_meta, values)=>({
                    values,
                    meta: {}
                }))
        };
        const turns = {
            advanceTurn: jest.fn((state)=>state)
        };
        const core = {
            appendLog: jest.fn((state, message)=>({
                    ...state,
                    log: [
                        ...Array.isArray(state.log) ? state.log : [],
                        {
                            message
                        }
                    ]
                }))
        };
        const service = new _frousseactionservice.FrousseActionService(random, turns, core, new _setupflowservice.SetupFlowService(), new _boardeffectspoliciesservice.BoardEffectsPoliciesService(), new _deckpoliciesservice.DeckPoliciesService(random));
        const state = {
            status: 'started',
            turnIndex: 0,
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'lilas'
                }
            ],
            pending: null,
            metadata: {
                positions: {
                    1: 10
                },
                statuses: {
                    skipTurn: {},
                    blocked: {},
                    nextMoveCap: {},
                    nextRollIfThreeBackTwo: {
                        1: true
                    },
                    nextRollKeepLowest: {},
                    nextRollMalus: {},
                    nextRollDouble: {},
                    ignoreTrapUntilNextDraw: {},
                    ignoreNextGhost: {},
                    ignoreNextPrank: {},
                    ignoreNextTrap: {}
                },
                tiles: [],
                pawns: [],
                decks: {
                    cards: [],
                    discard: []
                }
            },
            log: [],
            extras: {}
        };
        const next = service.applyActions(state, [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        const messages = (next.log ?? []).map((l)=>l.message);
        expect(messages).toContain('Reculez de 2 cases.');
        expect(messages).not.toContain('3 au dé, recul de 2 cases.');
    });
    it('formats doubled roll log with "=" (not "->")', ()=>{
        const random = {
            rollDice: jest.fn(()=>({
                    roll: 1,
                    meta: {}
                })),
            nextInt: jest.fn(()=>({
                    value: 0,
                    meta: {}
                })),
            pickOne: jest.fn(()=>({
                    value: null,
                    meta: {}
                })),
            shuffle: jest.fn((_meta, values)=>({
                    values,
                    meta: {}
                }))
        };
        const turns = {
            advanceTurn: jest.fn((state)=>state)
        };
        const core = {
            appendLog: jest.fn((state, message)=>({
                    ...state,
                    log: [
                        ...Array.isArray(state.log) ? state.log : [],
                        {
                            message
                        }
                    ]
                }))
        };
        const service = new _frousseactionservice.FrousseActionService(random, turns, core, new _setupflowservice.SetupFlowService(), new _boardeffectspoliciesservice.BoardEffectsPoliciesService(), new _deckpoliciesservice.DeckPoliciesService(random));
        const state = {
            status: 'started',
            turnIndex: 0,
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'pumbaa'
                }
            ],
            pending: null,
            metadata: {
                positions: {
                    1: 0
                },
                statuses: {
                    skipTurn: {},
                    blocked: {},
                    nextMoveCap: {},
                    nextRollIfThreeBackTwo: {},
                    nextRollKeepLowest: {},
                    nextRollMalus: {},
                    nextRollDouble: {
                        1: true
                    },
                    ignoreTrapUntilNextDraw: {},
                    ignoreNextGhost: {},
                    ignoreNextPrank: {},
                    ignoreNextTrap: {}
                },
                tiles: [],
                pawns: [],
                decks: {
                    cards: [],
                    discard: []
                }
            },
            log: [],
            extras: {}
        };
        const next = service.applyActions(state, [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        const messages = (next.log ?? []).map((l)=>String(l.message ?? ''));
        const rollMessage = messages.find((m)=>m.includes('lance le')) ?? '';
        expect(rollMessage).toMatch(/\(doubl.+ = 2\)/i);
        expect(rollMessage).not.toMatch(/doubl.+ ->/i);
    });
    it('formats malus roll log with explicit calculation', ()=>{
        const random = {
            rollDice: jest.fn(()=>({
                    roll: 6,
                    meta: {}
                })),
            nextInt: jest.fn(()=>({
                    value: 0,
                    meta: {}
                })),
            pickOne: jest.fn(()=>({
                    value: null,
                    meta: {}
                })),
            shuffle: jest.fn((_meta, values)=>({
                    values,
                    meta: {}
                }))
        };
        const turns = {
            advanceTurn: jest.fn((state)=>state)
        };
        const core = {
            appendLog: jest.fn((state, message)=>({
                    ...state,
                    log: [
                        ...Array.isArray(state.log) ? state.log : [],
                        {
                            message
                        }
                    ]
                }))
        };
        const service = new _frousseactionservice.FrousseActionService(random, turns, core, new _setupflowservice.SetupFlowService(), new _boardeffectspoliciesservice.BoardEffectsPoliciesService(), new _deckpoliciesservice.DeckPoliciesService(random));
        const state = {
            status: 'started',
            turnIndex: 0,
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'pumbaa'
                }
            ],
            pending: null,
            metadata: {
                positions: {
                    1: 0
                },
                statuses: {
                    skipTurn: {},
                    blocked: {},
                    nextMoveCap: {},
                    nextRollIfThreeBackTwo: {},
                    nextRollKeepLowest: {},
                    nextRollMalus: {
                        1: -2
                    },
                    nextRollDouble: {},
                    ignoreTrapUntilNextDraw: {},
                    ignoreNextGhost: {},
                    ignoreNextPrank: {},
                    ignoreNextTrap: {}
                },
                tiles: [],
                pawns: [],
                decks: {
                    cards: [],
                    discard: []
                }
            },
            log: [],
            extras: {}
        };
        const next = service.applyActions(state, [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        const messages = (next.log ?? []).map((l)=>String(l.message ?? ''));
        const rollMessage = messages.find((m)=>m.includes('lance le')) ?? '';
        expect(rollMessage).toContain('"6 moins 2 = 4"');
    });
    it('announces explicitly when a player must choose a pawn', ()=>{
        const random = {
            rollDice: jest.fn(()=>({
                    roll: 1,
                    meta: {}
                })),
            nextInt: jest.fn(()=>({
                    value: 0,
                    meta: {}
                })),
            pickOne: jest.fn(()=>({
                    value: null,
                    meta: {}
                })),
            shuffle: jest.fn((_meta, values)=>({
                    values,
                    meta: {}
                }))
        };
        const turns = {
            advanceTurn: jest.fn((state)=>state)
        };
        const core = {
            appendLog: jest.fn((state, message)=>({
                    ...state,
                    log: [
                        ...Array.isArray(state.log) ? state.log : [],
                        {
                            message
                        }
                    ]
                }))
        };
        const service = new _frousseactionservice.FrousseActionService(random, turns, core, new _setupflowservice.SetupFlowService(), new _boardeffectspoliciesservice.BoardEffectsPoliciesService(), new _deckpoliciesservice.DeckPoliciesService(random));
        const state = {
            status: 'started',
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
            pending: null,
            metadata: {
                pawns: [
                    {
                        id: 'citrouille-rigolote',
                        title: 'Une citrouille rigolote'
                    },
                    {
                        id: 'balai-farceur',
                        title: 'Un balai farceur'
                    }
                ]
            },
            log: [],
            extras: {}
        };
        const next = service.applyActions(state, [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        expect(next.pending?.type).toBe('choose_pawn');
        expect(String(next.pending?.label ?? '')).toContain("C'est à Lilas de choisir");
    });
    it('uses possessive pawn wording in placement logs', ()=>{
        const random = {
            rollDice: jest.fn(()=>({
                    roll: 2,
                    meta: {}
                })),
            nextInt: jest.fn(()=>({
                    value: 0,
                    meta: {}
                })),
            pickOne: jest.fn(()=>({
                    value: null,
                    meta: {}
                })),
            shuffle: jest.fn((_meta, values)=>({
                    values,
                    meta: {}
                }))
        };
        const turns = {
            advanceTurn: jest.fn((state)=>state)
        };
        const core = {
            appendLog: jest.fn((state, message)=>({
                    ...state,
                    log: [
                        ...Array.isArray(state.log) ? state.log : [],
                        {
                            message
                        }
                    ]
                }))
        };
        const service = new _frousseactionservice.FrousseActionService(random, turns, core, new _setupflowservice.SetupFlowService(), new _boardeffectspoliciesservice.BoardEffectsPoliciesService(), new _deckpoliciesservice.DeckPoliciesService(random));
        const state = {
            status: 'started',
            turnIndex: 0,
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'Lilas',
                    pawn: 'citrouille-rigolote',
                    pawnLabel: 'Une citrouille rigolote'
                },
                {
                    id: 2,
                    username: 'Bucky',
                    pawn: 'balai-farceur',
                    pawnLabel: 'Un balai farceur'
                }
            ],
            pending: null,
            metadata: {
                positions: {
                    1: 0,
                    2: 0
                },
                statuses: {
                    skipTurn: {},
                    blocked: {},
                    nextMoveCap: {},
                    nextRollIfThreeBackTwo: {},
                    nextRollKeepLowest: {},
                    nextRollMalus: {},
                    nextRollDouble: {},
                    ignoreTrapUntilNextDraw: {},
                    ignoreNextGhost: {},
                    ignoreNextPrank: {},
                    ignoreNextTrap: {}
                },
                tiles: [
                    {
                        n: 1,
                        type: 'normal',
                        title: 'Départ',
                        label: 'case 1. Départ (case neutre)',
                        description: ''
                    },
                    {
                        n: 2,
                        type: 'normal',
                        title: 'Hall',
                        label: 'case 2. Hall (case neutre)',
                        description: ''
                    },
                    {
                        n: 3,
                        type: 'normal',
                        title: 'Couloir des portraits',
                        label: 'case 3. Couloir des portraits (case neutre)',
                        description: ''
                    }
                ],
                decks: {
                    cards: [],
                    discard: []
                }
            },
            log: [],
            extras: {}
        };
        const next = service.applyActions(state, [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        const messages = (next.log ?? []).map((l)=>String(l.message ?? ''));
        const placement = messages.find((m)=>m.includes('Bucky place')) ?? '';
        expect(placement).toContain('"son balai farceur"');
        expect(placement).not.toContain('"Un balai farceur"');
    });
    it('avoids duplicate replay logs when draw effect already states replay rule', ()=>{
        const random = {
            rollDice: jest.fn(()=>({
                    roll: 1,
                    meta: {}
                })),
            nextInt: jest.fn(()=>({
                    value: 0,
                    meta: {}
                })),
            pickOne: jest.fn(()=>({
                    value: null,
                    meta: {}
                })),
            shuffle: jest.fn((_meta, values)=>({
                    values,
                    meta: {}
                }))
        };
        const turns = {
            advanceTurn: jest.fn((state)=>state)
        };
        const core = {
            appendLog: jest.fn((state, message)=>({
                    ...state,
                    log: [
                        ...Array.isArray(state.log) ? state.log : [],
                        {
                            message
                        }
                    ]
                }))
        };
        const service = new _frousseactionservice.FrousseActionService(random, turns, core, new _setupflowservice.SetupFlowService(), new _boardeffectspoliciesservice.BoardEffectsPoliciesService(), new _deckpoliciesservice.DeckPoliciesService(random));
        const state = {
            status: 'started',
            turnIndex: 0,
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            players: [
                {
                    id: 1,
                    username: 'Lilas'
                }
            ],
            pending: {
                type: 'draw',
                playerId: 1,
                blocking: true
            },
            metadata: {
                positions: {
                    1: 0
                },
                statuses: {
                    skipTurn: {},
                    blocked: {},
                    nextMoveCap: {},
                    nextRollIfThreeBackTwo: {},
                    nextRollKeepLowest: {},
                    nextRollMalus: {},
                    nextRollDouble: {},
                    ignoreTrapUntilNextDraw: {},
                    ignoreNextGhost: {},
                    ignoreNextPrank: {},
                    ignoreNextTrap: {}
                },
                tiles: [],
                decks: {
                    cards: [
                        {
                            category: 'Piège',
                            localNumber: 1,
                            text: 'Une bougie clignote et vous joue un tour. Lancez le dé deux fois et gardez le plus petit résultat.'
                        }
                    ],
                    discard: []
                }
            },
            log: [],
            extras: {}
        };
        const next = service.applyActions(state, [
            {
                type: 'draw',
                payload: {}
            }
        ]);
        const messages = (next.log ?? []).map((l)=>String(l.message ?? ''));
        expect(messages.some((m)=>/^Lilas rejoue/i.test(m) || /rejoue\s*\(/i.test(m))).toBe(false);
        expect(messages.some((m)=>/gardez le plus petit résultat/i.test(m))).toBe(true);
    });
    it('lets the player refuse a swap card and advances the turn', ()=>{
        const { service } = buildRealTurnService();
        const state = buildTurnState({
            pending: {
                type: 'draw',
                playerId: 1,
                blocking: true
            },
            metadata: buildFrousseMeta({
                decks: {
                    cards: [
                        {
                            category: 'Farce',
                            localNumber: 3,
                            text: 'Un autre joueur vous joue une farce. Echangez immédiatement vos places.'
                        }
                    ],
                    discard: []
                }
            })
        });
        const afterDraw = service.applyActions(state, [
            {
                type: 'draw',
                payload: {}
            }
        ]);
        expect(afterDraw.pending?.type).toBe('choose_target');
        expect(afterDraw.pending?.choices).toEqual([
            'Hacene',
            "Refuser l'échange."
        ]);
        expect(_rulebook.getAvailableActions(afterDraw, 1)).toContainEqual({
            type: 'swap_decline',
            payload: {}
        });
        const afterDecline = service.applyActions(afterDraw, [
            {
                type: 'swap_decline',
                payload: {}
            }
        ]);
        const messages = (afterDecline.log ?? []).map((entry)=>String(entry?.message ?? ''));
        expect(afterDecline.pending).toBeNull();
        expect(afterDecline.turn?.currentPlayerId).toBe(2);
        expect(messages).toContain("Lilas refuse l'échange de position.");
        expect(messages).toContain("C'est au tour de Hacene.");
    });
    it('does not replay on a neutral tile after an immediate replay card', ()=>{
        const rollDice = jest.fn().mockReturnValueOnce({
            roll: 4,
            meta: {}
        }).mockReturnValueOnce({
            roll: 2,
            meta: {}
        });
        const { service } = buildRealTurnService({
            rollDice
        });
        const state = buildTurnState({
            pending: {
                type: 'draw',
                playerId: 1,
                blocking: true
            },
            metadata: buildFrousseMeta({
                decks: {
                    cards: [
                        {
                            category: 'Farce',
                            localNumber: 11,
                            text: 'Une bougie clignote et vous joue un tour. Lancez le dé deux fois et gardez le plus petit résultat.'
                        }
                    ],
                    discard: []
                }
            })
        });
        const afterDraw = service.applyActions(state, [
            {
                type: 'draw',
                payload: {}
            }
        ]);
        expect(afterDraw.turn?.currentPlayerId).toBe(1);
        expect(afterDraw.pending).toBeNull();
        const afterRoll = service.applyActions(afterDraw, [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        const messages = (afterRoll.log ?? []).map((entry)=>String(entry?.message ?? ''));
        expect(afterRoll.turn?.currentPlayerId).toBe(2);
        expect(messages).toContain("C'est au tour de Hacene.");
        expect(messages.some((message)=>/^Lilas rejoue\./i.test(message))).toBe(false);
    });
    it('advances to the next player immediately after a skip-turn card', ()=>{
        const { service } = buildRealTurnService();
        const state = buildTurnState({
            pending: {
                type: 'draw',
                playerId: 1,
                blocking: true
            },
            metadata: buildFrousseMeta({
                decks: {
                    cards: [
                        {
                            category: 'Piège',
                            localNumber: 2,
                            text: 'Vous glissez sur une flaque gluante et malodorante. Impossible de vous relever tout de suite. Passez 1 tour.'
                        }
                    ],
                    discard: []
                }
            })
        });
        const afterDraw = service.applyActions(state, [
            {
                type: 'draw',
                payload: {}
            }
        ]);
        const messages = (afterDraw.log ?? []).map((entry)=>String(entry?.message ?? ''));
        expect(afterDraw.turn?.currentPlayerId).toBe(2);
        expect(afterDraw.metadata?.statuses?.skipTurn?.[1]).toBe(1);
        expect(messages.at(-1)).toBe("C'est au tour de Hacene.");
    });
});
