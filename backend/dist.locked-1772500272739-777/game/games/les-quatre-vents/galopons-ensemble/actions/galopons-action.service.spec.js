"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _randomservice = require("../../../../modules/random/services/random.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _turnservice = require("../../../../modules/turn/services/turn.service");
const _turnpoliciesservice = require("../../../../modules/turn-policies/services/turn-policies.service");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _galoponsactionservice = require("./galopons-action.service");
function buildTiles() {
    const tiles = Array.from({
        length: 40
    }, (_, i)=>({
            n: i + 1,
            title: `T${i + 1}`,
            type: 'neutral',
            region: i % 4 === 0 ? 'foret' : i % 4 === 1 ? 'montagne' : 'prairie'
        }));
    tiles[0] = {
        n: 1,
        title: 'Start',
        type: 'start',
        region: 'prairie'
    };
    tiles[1] = {
        n: 2,
        title: 'Card',
        type: 'card',
        region: 'foret'
    };
    tiles[2] = {
        n: 3,
        title: 'Bonus',
        type: 'bonus',
        apples: 2,
        region: 'montagne'
    };
    tiles[3] = {
        n: 4,
        title: 'Skip',
        type: 'skip',
        skipTurns: 1,
        region: 'riviere'
    };
    tiles[4] = {
        n: 5,
        title: 'Finish',
        type: 'finish',
        region: 'prairie'
    };
    return tiles;
}
function makeState() {
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
                username: 'P1'
            },
            {
                id: 2,
                username: 'P2'
            },
            {
                id: 3,
                username: 'P3'
            }
        ],
        turn: {
            currentPlayerId: 1,
            direction: 1
        },
        pending: null,
        botThinking: false,
        metadata: {
            tiles: buildTiles(),
            positions: {
                1: 0,
                2: 1,
                3: 2
            },
            apples: {
                1: 2,
                2: 1,
                3: 0
            },
            ious: {
                1: {},
                2: {
                    1: 1
                },
                3: {}
            },
            statuses: {
                skipTurn: {
                    1: 0,
                    2: 0,
                    3: 0
                }
            },
            decks: {
                cards: [
                    {
                        id: 1,
                        text: 'Recevez 2 jetons Pomme'
                    }
                ],
                discard: []
            },
            pendingContext: null,
            finish: {
                triggered: false,
                starterId: null,
                pendingIds: [],
                bonusGiven: false
            },
            winnerId: null
        }
    };
}
function meta(state) {
    return state.metadata;
}
function makeRuntime(rolls = []) {
    const random = new _randomservice.RandomService();
    let i = 0;
    jest.spyOn(random, 'rollDice').mockImplementation((meta)=>({
            roll: rolls[i++] ?? 1,
            meta
        }));
    const core = new _gamecoreservice.GameCoreService();
    const turns = new _turnflowservice.TurnFlowService(new _turnservice.TurnService(), new _turnpoliciesservice.TurnPoliciesService(core));
    const deckPolicies = new _deckpoliciesservice.DeckPoliciesService(random);
    return {
        service: new _galoponsactionservice.GaloponsActionService(random, turns, core, deckPolicies)
    };
}
describe('GaloponsActionService', ()=>{
    it('handles roll with iou repayment and skip turns', ()=>{
        const { service } = makeRuntime([
            1,
            2
        ]);
        let state = makeState();
        state = {
            ...state,
            turn: {
                currentPlayerId: 2,
                direction: 1
            },
            metadata: {
                ...meta(state),
                statuses: {
                    skipTurn: {
                        1: 0,
                        2: 1,
                        3: 0
                    }
                }
            }
        };
        const skipped = service.applyActions(state, [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        expect(skipped).toBeDefined();
        const rolled = service.applyActions(makeState(), [
            {
                type: 'roll',
                payload: {}
            }
        ]);
        expect(rolled).toBeDefined();
    });
    it('covers landing tile variants and finish trigger', ()=>{
        const { service } = makeRuntime();
        const base = makeState();
        for (const pos of [
            1,
            2,
            3,
            4
        ]){
            const state = {
                ...base,
                metadata: {
                    ...meta(base),
                    positions: {
                        ...meta(base).positions,
                        1: pos
                    }
                }
            };
            const out = service.applyLanding(state, 1);
            expect(out).toBeDefined();
        }
    });
    it('covers choose_target contexts pair_advance, give_apple and help_advance', ()=>{
        const { service } = makeRuntime();
        const contexts = [
            'pair_advance',
            'give_apple',
            'help_advance'
        ];
        for (const kind of contexts){
            const state = {
                ...makeState(),
                pending: {
                    type: 'choose_target',
                    playerId: 1,
                    blocking: true,
                    choices: [
                        'P2'
                    ]
                },
                turn: {
                    currentPlayerId: 1,
                    direction: 1
                },
                metadata: {
                    ...meta(makeState()),
                    pendingContext: {
                        kind,
                        actorId: 1,
                        replayAfter: true
                    }
                }
            };
            const out = service.applyActions(state, [
                {
                    type: 'choose_target',
                    payload: {
                        targetPlayerId: 2
                    }
                }
            ]);
            expect(out).toBeDefined();
        }
    });
    it('covers adventure card text branches', ()=>{
        const { service } = makeRuntime();
        const texts = [
            'Donnez-lui une pomme',
            'Rejouez',
            'Recevez 2 jetons Pomme',
            'Recevez un jeton pomme',
            'Passez votre tour',
            'Tous les joueurs restent sur place pendant un tour',
            "Choisissez un joueur et avancez tout les deux d'une case",
            'aidez un autre joueur en le faisant avancer de 2 cases',
            "Défaussez-vous d'une pomme",
            "Avancez jusqu'à la prochaine case forêt",
            "Avancez jusqu'à la prochaine case montagne",
            'Avancez de 3 cases',
            'Reculez de 2 cases'
        ];
        for (const text of texts){
            const out = service.applyCard(makeState(), 1, {
                id: 99,
                text
            });
            expect(out).toBeDefined();
        }
    });
    it('covers helper methods drawCard, findOccupant, pawnLabel and finishGame', ()=>{
        const { service } = makeRuntime();
        const state = makeState();
        const draw = service.drawCard(meta(state));
        expect(draw).toBeDefined();
        expect(service.findOccupant(meta(state), 1, 1)).toBe(2);
        expect(service.pawnLabel(state, 1)).toContain('son');
        const finished = service.finishGame({
            ...state,
            metadata: {
                ...meta(state),
                apples: {
                    1: 1,
                    2: 4,
                    3: 2
                }
            }
        });
        expect(finished.status).toBe('finished');
        expect(meta(finished).winnerId).toBe(2);
    });
});
