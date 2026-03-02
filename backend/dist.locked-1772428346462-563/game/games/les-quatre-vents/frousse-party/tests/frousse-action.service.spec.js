"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
const _boardeffectspoliciesservice = require("../../../../modules/board-effects-policies/services/board-effects-policies.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _frousseactionservice = require("../actions/frousse-action.service");
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
});
