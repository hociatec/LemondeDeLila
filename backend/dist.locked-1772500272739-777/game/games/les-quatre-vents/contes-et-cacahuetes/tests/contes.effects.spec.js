"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _testing = require("@nestjs/testing");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _contesetcacahuetessetupservice = require("../setup/contes-et-cacahuetes-setup.service");
const _contesactionservice = require("../actions/contes-action.service");
function asRecord(value) {
    return value != null && typeof value === 'object' ? value : {};
}
function toText(value) {
    return typeof value === 'string' ? value : '';
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
                username: 'Lilas',
                isBot: false
            },
            {
                id: 2,
                username: 'Bucky',
                isBot: true
            },
            {
                id: 3,
                username: 'Otis',
                isBot: false
            }
        ],
        turn: {
            currentPlayerId: 1,
            direction: 1
        },
        metadata: {
            gameType: 'contes-et-cacahuetes',
            rng: {
                seed: 1234,
                counter: 0
            }
        },
        botThinking: false
    };
}
describe('Contes effects', ()=>{
    it('keeps Cape d’Invisibilite aligned with malus tile behavior', async ()=>{
        const moduleRef = await _testing.Test.createTestingModule({
            providers: [
                _gamecoreservice.GameCoreService,
                _randomservice.RandomService,
                _setupflowservice.SetupFlowService,
                _contesetcacahuetessetupservice.ContesCacahuetesSetupService
            ]
        }).compile();
        const setup = moduleRef.get(_contesetcacahuetessetupservice.ContesCacahuetesSetupService);
        const state = setup.hydrateInitialState(baseState());
        const metadata = asRecord(state.metadata);
        const decks = asRecord(metadata.decks);
        const bonusDeck = Array.isArray(decks.bonus) ? decks.bonus : [];
        const cape = bonusDeck.find((card)=>{
            const row = asRecord(card);
            return Number(row.id ?? 0) === 4;
        });
        const capeRow = asRecord(cape);
        expect(toText(capeRow.text)).toContain('case Malus');
        expect(toText(capeRow.text)).not.toContain('case Conte');
    });
    it('requires a number choice from each player for Poussiere de rire', async ()=>{
        const moduleRef = await _testing.Test.createTestingModule({
            providers: [
                _gamecoreservice.GameCoreService,
                _randomservice.RandomService,
                _setupflowservice.SetupFlowService,
                _deckpoliciesservice.DeckPoliciesService,
                _contesetcacahuetessetupservice.ContesCacahuetesSetupService,
                {
                    provide: 'TurnFlowService',
                    useValue: {
                        advanceTurn: (state)=>state
                    }
                },
                {
                    provide: _contesactionservice.ContesActionService,
                    useFactory: (core, random, turns, setupFlow, deckPolicies)=>new _contesactionservice.ContesActionService(core, random, turns, setupFlow, deckPolicies),
                    inject: [
                        _gamecoreservice.GameCoreService,
                        _randomservice.RandomService,
                        'TurnFlowService',
                        _setupflowservice.SetupFlowService,
                        _deckpoliciesservice.DeckPoliciesService
                    ]
                }
            ]
        }).compile();
        const setup = moduleRef.get(_contesetcacahuetessetupservice.ContesCacahuetesSetupService);
        const actionsService = moduleRef.get(_contesactionservice.ContesActionService);
        let state = setup.hydrateInitialState(baseState());
        state = {
            ...state,
            pending: {
                type: 'choose_number',
                label: 'Poussiere de rire',
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
            },
            metadata: {
                ...state.metadata ?? {},
                positions: {
                    1: 58,
                    2: 58,
                    3: 58
                }
            }
        };
        const chooseTwo = [
            {
                type: 'choose_number',
                payload: {
                    value: 2
                }
            }
        ];
        state = actionsService.applyActions(state, chooseTwo);
        const pending1 = asRecord(state.pending);
        const data1 = asRecord(pending1.data);
        const picks1 = asRecord(data1.picks);
        expect(Number(pending1.playerId)).toBe(2);
        expect(Number(picks1['1'] ?? 0)).toBe(2);
        const chooseThree = [
            {
                type: 'choose_number',
                payload: {
                    value: 3
                }
            }
        ];
        state = actionsService.applyActions(state, chooseThree);
        const pending2 = asRecord(state.pending);
        const data2 = asRecord(pending2.data);
        const picks2 = asRecord(data2.picks);
        expect(Number(pending2.playerId)).toBe(3);
        expect(Number(picks2['2'] ?? 0)).toBe(3);
        const chooseOne = [
            {
                type: 'choose_number',
                payload: {
                    value: 1
                }
            }
        ];
        state = actionsService.applyActions(state, chooseOne);
        expect(state.pending ?? null).toBeNull();
        expect(String(state.status ?? '').toLowerCase()).toBe('finished');
        const finalMeta = asRecord(state.metadata);
        expect(Number(finalMeta.winnerId ?? 0)).toBe(2);
    });
    it('ends the turn after resolving a draw pending with no follow-up pending', async ()=>{
        const advanceTurn = jest.fn((state)=>({
                ...state,
                turnIndex: 1,
                turn: {
                    ...state.turn ?? {
                        direction: 1
                    },
                    currentPlayerId: 2
                }
            }));
        const moduleRef = await _testing.Test.createTestingModule({
            providers: [
                _gamecoreservice.GameCoreService,
                _randomservice.RandomService,
                _setupflowservice.SetupFlowService,
                _deckpoliciesservice.DeckPoliciesService,
                _contesetcacahuetessetupservice.ContesCacahuetesSetupService,
                {
                    provide: 'TurnFlowService',
                    useValue: {
                        advanceTurn
                    }
                },
                {
                    provide: _contesactionservice.ContesActionService,
                    useFactory: (core, random, turns, setupFlow, deckPolicies)=>new _contesactionservice.ContesActionService(core, random, turns, setupFlow, deckPolicies),
                    inject: [
                        _gamecoreservice.GameCoreService,
                        _randomservice.RandomService,
                        'TurnFlowService',
                        _setupflowservice.SetupFlowService,
                        _deckpoliciesservice.DeckPoliciesService
                    ]
                }
            ]
        }).compile();
        const setup = moduleRef.get(_contesetcacahuetessetupservice.ContesCacahuetesSetupService);
        const actionsService = moduleRef.get(_contesactionservice.ContesActionService);
        let state = setup.hydrateInitialState(baseState());
        const metadata = asRecord(state.metadata);
        const decks = asRecord(metadata.decks);
        const bonusDeck = Array.isArray(decks.bonus) ? decks.bonus : [];
        const parch = bonusDeck.find((card)=>Number(asRecord(card).id ?? 0) === 2);
        expect(parch).toBeTruthy();
        state = {
            ...state,
            turn: {
                ...state.turn ?? {
                    direction: 1
                },
                currentPlayerId: 1
            },
            pending: {
                type: 'draw',
                label: 'Piocher une carte BONUS (Espace).',
                playerId: 1,
                blocking: true,
                data: {
                    context: 'draw_and_apply',
                    cardType: 'bonus',
                    depth: 0
                }
            },
            metadata: {
                ...state.metadata ?? {},
                decks: {
                    ...decks,
                    bonus: [
                        parch
                    ],
                    discardBonus: []
                }
            }
        };
        state = actionsService.applyActions(state, [
            {
                type: 'draw',
                payload: {}
            }
        ]);
        expect(advanceTurn).toHaveBeenCalledTimes(1);
        expect(state.pending ?? null).toBeNull();
        expect(Number(state.turn?.currentPlayerId ?? 0)).toBe(2);
    });
});
