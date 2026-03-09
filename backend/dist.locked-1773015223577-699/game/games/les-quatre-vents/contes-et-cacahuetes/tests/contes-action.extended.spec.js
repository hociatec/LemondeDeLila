"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _turnservice = require("../../../../modules/turn/services/turn.service");
const _turnpoliciesservice = require("../../../../modules/turn-policies/services/turn-policies.service");
const _contesetcacahuetessetupservice = require("../setup/contes-et-cacahuetes-setup.service");
const _contesactionservice = require("../actions/contes-action.service");
function deepClone(value) {
    try {
        return structuredClone(value);
    } catch  {
        return JSON.parse(JSON.stringify(value));
    }
}
function makeBaseState() {
    return {
        status: 'started',
        phase: 'playing',
        round: 1,
        turnIndex: 0,
        lastRoll: null,
        log: [],
        players: [
            {
                id: 1,
                username: 'P1',
                pawn: 'Aika - Mongolie'
            },
            {
                id: 2,
                username: 'P2',
                pawn: 'Freja - Suède'
            },
            {
                id: 3,
                username: 'P3',
                pawn: 'Lani - Îles Marshall'
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
}
function makeRuntime() {
    const random = new _randomservice.RandomService();
    let rollIndex = 0;
    let intIndex = 0;
    const rollSeq = [
        2,
        4,
        1,
        6,
        3,
        5,
        2,
        1,
        4,
        6,
        3,
        2
    ];
    const intSeq = [
        0,
        1,
        2,
        0,
        1,
        2,
        1,
        0,
        2
    ];
    jest.spyOn(random, 'rollDice').mockImplementation((meta)=>({
            roll: rollSeq[rollIndex++ % rollSeq.length],
            meta
        }));
    jest.spyOn(random, 'nextInt').mockImplementation((meta, max)=>({
            value: max > 0 ? intSeq[intIndex++ % intSeq.length] % max : 0,
            meta
        }));
    jest.spyOn(random, 'shuffle').mockImplementation((meta, values)=>({
            values: [
                ...values
            ],
            meta
        }));
    const core = new _gamecoreservice.GameCoreService();
    const setupFlow = new _setupflowservice.SetupFlowService();
    const setup = new _contesetcacahuetessetupservice.ContesCacahuetesSetupService(core, random, setupFlow);
    const turnPolicies = new _turnpoliciesservice.TurnPoliciesService(core);
    const turns = new _turnflowservice.TurnFlowService(new _turnservice.TurnService(), turnPolicies);
    const deckPolicies = new _deckpoliciesservice.DeckPoliciesService(random);
    const actions = new _contesactionservice.ContesActionService(core, random, turns, setupFlow, deckPolicies, turnPolicies);
    const state = setup.hydrateInitialState(makeBaseState());
    return {
        actions,
        state
    };
}
function readyState(state) {
    return {
        ...deepClone(state),
        status: 'started',
        phase: 'playing',
        pending: null,
        turn: {
            currentPlayerId: 1,
            direction: 1
        }
    };
}
describe('ContesActionService extended coverage', ()=>{
    it('covers bonus effects 1..15', ()=>{
        const { actions, state } = makeRuntime();
        for(let id = 1; id <= 15; id += 1){
            const out = actions.applyBonusEffectById(readyState(state), 1, id, 0);
            expect(out).toBeDefined();
        }
    });
    it('covers malus effects 1..15', ()=>{
        const { actions, state } = makeRuntime();
        for(let id = 1; id <= 15; id += 1){
            const out = actions.applyMalusEffectById(readyState(state), 1, id, 0);
            expect(out).toBeDefined();
        }
    });
    it('covers surprise effects 1..15', ()=>{
        const { actions, state } = makeRuntime();
        for(let id = 1; id <= 15; id += 1){
            const out = actions.applySurpriseEffectById(readyState(state), 1, id, 0);
            expect(out).toBeDefined();
        }
    });
    it('covers choose_target / choose_number / choose_option / choose_card contexts', ()=>{
        const { actions, state } = makeRuntime();
        const base = readyState(state);
        const targetContexts = [
            'move_other_2',
            'swap_positions',
            'turn_swap_next',
            'song_take_bonus',
            'steal_bonus',
            'steal_bonus_or_surprise',
            'wish_swap',
            'grimoire_voyageur',
            'key_gold_choose_target',
            'give_bonus_choose_target'
        ];
        for (const context of targetContexts){
            const out = actions.applyActions({
                ...deepClone(base),
                pending: {
                    type: 'choose_target',
                    label: 'choose',
                    playerId: 1,
                    blocking: true,
                    choices: [
                        'P2'
                    ],
                    data: {
                        context,
                        targets: [
                            {
                                targetPlayerId: 2,
                                targetUsername: 'P2'
                            }
                        ]
                    }
                }
            }, [
                {
                    type: 'choose_target',
                    payload: {
                        targetPlayerId: 2
                    }
                }
            ]);
            expect(out).toBeDefined();
        }
        const numberOut = actions.applyActions({
            ...deepClone(base),
            pending: {
                type: 'choose_number',
                label: 'number',
                playerId: 1,
                blocking: true,
                choices: [
                    '1',
                    '2',
                    '3'
                ],
                data: {
                    context: 'laughter_dust',
                    min: 1,
                    max: 3,
                    order: [
                        1,
                        2,
                        3
                    ],
                    picks: {}
                }
            }
        }, [
            {
                type: 'choose_number',
                payload: {
                    value: 2
                }
            }
        ]);
        expect(numberOut).toBeDefined();
        const optionOut = actions.applyActions({
            ...deepClone(base),
            pending: {
                type: 'choose_option',
                label: 'opt',
                playerId: 1,
                blocking: true,
                choices: [
                    'Avancer de 3',
                    'Prendre une carte Bonus'
                ],
                data: {
                    context: 'song_choice'
                }
            }
        }, [
            {
                type: 'choose_option',
                payload: {
                    option: 'Avancer de 3'
                }
            }
        ]);
        expect(optionOut).toBeDefined();
        const cardOut = actions.applyActions({
            ...deepClone(base),
            pending: {
                type: 'choose_card',
                label: 'card',
                playerId: 1,
                blocking: true,
                choices: [
                    'X'
                ],
                data: {
                    context: 'abondance_keep_one:1',
                    cards: [
                        {
                            cardType: 'bonus',
                            cardId: 1,
                            title: 'Carte 1'
                        }
                    ]
                }
            }
        }, [
            {
                type: 'choose_card',
                payload: {
                    cardType: 'bonus',
                    cardId: 1
                }
            }
        ]);
        expect(cardOut).toBeDefined();
    });
    it('covers draw queue and abondance contexts', ()=>{
        const { actions, state } = makeRuntime();
        const base = readyState(state);
        const queueOut = actions.applyActions({
            ...deepClone(base),
            pending: {
                type: 'draw',
                label: 'draw',
                playerId: 1,
                blocking: true,
                data: {
                    context: 'draw_and_apply',
                    queue: [
                        'bonus',
                        'surprise'
                    ],
                    depth: 0
                }
            }
        }, [
            {
                type: 'draw',
                payload: {}
            }
        ]);
        expect(queueOut).toBeDefined();
        const abondanceOut = actions.applyActions({
            ...deepClone(base),
            pending: {
                type: 'draw',
                label: 'abondance',
                playerId: 1,
                blocking: true,
                data: {
                    context: 'abondance',
                    remaining: 2,
                    drawn: []
                }
            }
        }, [
            {
                type: 'draw',
                payload: {}
            }
        ]);
        expect(abondanceOut).toBeDefined();
    });
    it('covers roll and reroll public actions', ()=>{
        const { actions, state } = makeRuntime();
        const rolled = actions.applyActions(readyState(state), [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        expect(rolled).toBeDefined();
        const rerollYes = actions.applyActions({
            ...readyState(state),
            pending: {
                type: 'reroll',
                label: 'reroll',
                playerId: 1,
                blocking: true,
                choices: [
                    'Relancer',
                    'Garder'
                ],
                data: {
                    baseRoll: 3
                }
            }
        }, [
            {
                type: 'reroll_yes',
                payload: {}
            }
        ]);
        expect(rerollYes).toBeDefined();
        const rerollNo = actions.applyActions({
            ...readyState(state),
            pending: {
                type: 'reroll',
                label: 'reroll',
                playerId: 1,
                blocking: true,
                choices: [
                    'Relancer',
                    'Garder'
                ],
                data: {
                    baseRoll: 3
                }
            }
        }, [
            {
                type: 'reroll_no',
                payload: {}
            }
        ]);
        expect(rerollNo).toBeDefined();
    });
});
