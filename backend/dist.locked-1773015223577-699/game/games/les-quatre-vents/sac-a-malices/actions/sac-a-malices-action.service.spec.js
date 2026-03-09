"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _sacamalicesactionservice = require("./sac-a-malices-action.service");
function makeBaseState() {
    return {
        status: 'started',
        phase: 'playing',
        round: 1,
        turnIndex: 0,
        lastRoll: 2,
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
        metadata: {
            variantId: 'classic',
            setupStep: 'playing',
            setupStarterId: 1,
            tiles: [
                {
                    n: 1,
                    title: 'Départ',
                    type: 'start'
                },
                {
                    n: 2,
                    title: 'Rue Rouge A',
                    type: 'property',
                    group: 'Rouge'
                },
                {
                    n: 3,
                    title: 'Chance',
                    type: 'chance'
                },
                {
                    n: 4,
                    title: 'Rue Rouge B',
                    type: 'property',
                    group: 'Rouge'
                },
                {
                    n: 5,
                    title: 'Taxe',
                    type: 'tax',
                    description: 'Payez 200 €'
                },
                {
                    n: 6,
                    title: 'Gare de Lille',
                    type: 'station'
                },
                {
                    n: 7,
                    title: 'Compagnie Eau',
                    type: 'utility'
                },
                {
                    n: 8,
                    title: 'Prison',
                    type: 'jail'
                },
                {
                    n: 9,
                    title: 'Parc Gratuit',
                    type: 'free'
                },
                {
                    n: 10,
                    title: 'Allez en prison',
                    type: 'go_to_jail'
                },
                {
                    n: 11,
                    title: 'Caisse',
                    type: 'community'
                },
                {
                    n: 12,
                    title: 'Rue Bleue A',
                    type: 'property',
                    group: 'Bleu'
                },
                {
                    n: 13,
                    title: 'Rue Bleue B',
                    type: 'property',
                    group: 'Bleu'
                }
            ],
            positions: {
                1: 0,
                2: 0,
                3: 0
            },
            money: {
                1: 2000,
                2: 2000,
                3: 2000
            },
            ownership: {},
            buildings: {},
            statuses: {
                skipTurn: {
                    1: 0,
                    2: 0,
                    3: 0
                },
                inJail: {
                    1: 0,
                    2: 0,
                    3: 0
                },
                eliminated: {
                    1: false,
                    2: false,
                    3: false
                },
                getOutOfJail: {
                    1: 0,
                    2: 0,
                    3: 0
                },
                extraRoll: {
                    1: false,
                    2: false,
                    3: false
                },
                consecutiveDoubles: {
                    1: 0,
                    2: 0,
                    3: 0
                }
            },
            pot: 0,
            rules: {
                startMoney: 2000,
                passStartBonus: 200,
                potEnabled: true,
                rentBlockedInJail: true,
                jail: {
                    maxTurns: 3,
                    autoFine: 100,
                    allowPayFine: true,
                    allowDoubleEscape: false
                }
            },
            decks: {
                chance: {
                    cards: [
                        {
                            id: 1,
                            text: 'Sortie de prison'
                        },
                        {
                            id: 2,
                            text: 'Payez 50 €'
                        }
                    ],
                    discard: []
                },
                community: {
                    cards: [
                        {
                            id: 3,
                            text: 'Tous les joueurs paient 30'
                        }
                    ],
                    discard: []
                }
            },
            data: {
                groups: [
                    {
                        color: 'Rouge',
                        properties: [
                            'Rue Rouge A',
                            'Rue Rouge B'
                        ],
                        purchasePrice: 120,
                        mortgage: 60,
                        unmortgageCost: 70,
                        rents: {
                            base: 10,
                            house1: 20,
                            house2: 30,
                            house3: 50,
                            house4: 80,
                            hotel: 120
                        },
                        housePrice: 50,
                        hotelPrice: 100,
                        housePrices: {
                            '1': 50,
                            '2': 55,
                            '3': 60,
                            '4': 65
                        }
                    },
                    {
                        color: 'Bleu',
                        properties: [
                            'Rue Bleue A',
                            'Rue Bleue B'
                        ],
                        purchasePrice: 100,
                        mortgage: 50,
                        unmortgageCost: 60,
                        rents: {
                            base: 9,
                            house1: 18,
                            house2: 27,
                            house3: 45,
                            house4: 72,
                            hotel: 108
                        },
                        housePrice: 40,
                        hotelPrice: 80
                    }
                ],
                stations: {
                    properties: [
                        'Gare de Lille'
                    ],
                    purchasePrice: 200,
                    mortgage: 100,
                    unmortgageCost: 120,
                    rents: {
                        '1': 25,
                        '2': 50,
                        '3': 100,
                        '4': 200
                    }
                },
                utilities: [
                    {
                        name: 'Compagnie Eau',
                        purchasePrice: 150,
                        mortgage: 75,
                        unmortgageCost: 90,
                        multiplier1: 4,
                        multiplier2: 10
                    }
                ]
            },
            winnerId: null
        },
        pending: null,
        botThinking: false
    };
}
function makeService(rolls = []) {
    const random = new _randomservice.RandomService();
    let rollIdx = 0;
    jest.spyOn(random, 'rollDice').mockImplementation((meta)=>({
            roll: rolls[rollIdx++] ?? 2,
            meta: {
                ...meta ?? {},
                counter: Number((meta ?? {})?.counter ?? 0) + 1
            }
        }));
    jest.spyOn(random, 'pickOne').mockImplementation((meta, list)=>({
            value: Array.isArray(list) ? list[0] : null,
            meta: {
                ...meta ?? {},
                counter: Number((meta ?? {})?.counter ?? 0) + 1
            }
        }));
    const core = new _gamecoreservice.GameCoreService();
    const setup = {
        applyVariantSelection: jest.fn((state, variant)=>({
                ...state,
                metadata: {
                    ...state.metadata,
                    variantId: variant,
                    setupStep: 'playing'
                }
            }))
    };
    const deckPolicies = new _deckpoliciesservice.DeckPoliciesService(random);
    return {
        service: new _sacamalicesactionservice.SacAMalicesActionService(random, core, setup, deckPolicies),
        setup
    };
}
function getMeta(state) {
    return state.metadata;
}
describe('SacAMalicesActionService', ()=>{
    it('dispatches all public actions and applies variant selection', ()=>{
        const { service, setup } = makeService([
            2,
            3,
            2,
            2
        ]);
        let state = makeBaseState();
        state = {
            ...state,
            metadata: {
                ...getMeta(state),
                setupStep: 'setup_config'
            }
        };
        state = service.applyActions(state, [
            {
                type: 'sac_set_variant',
                payload: {
                    variant: 'gaia'
                },
                meta: {
                    actorId: 1
                }
            }
        ]);
        expect(setup.applyVariantSelection).toHaveBeenCalled();
        expect(getMeta(state).variantId).toBe('gaia');
        state = {
            ...state,
            metadata: {
                ...getMeta(state),
                setupStep: 'playing'
            },
            pending: {
                type: 'buy',
                playerId: 1,
                blocking: true,
                data: {
                    tileIndex: 1
                }
            }
        };
        state = service.applyActions(state, [
            {
                type: 'buy',
                payload: {}
            }
        ]);
        expect(getMeta(state).ownership[1]).toBe(1);
        state = {
            ...state,
            pending: {
                type: 'choose_property',
                playerId: 1,
                blocking: true,
                data: {
                    kind: 'mortgage',
                    options: [
                        {
                            tileIndex: 1
                        }
                    ]
                }
            }
        };
        state = service.applyActions(state, [
            {
                type: 'choose_property',
                payload: {
                    tileIndex: 1
                }
            }
        ]);
        expect(getMeta(state).buildings[1]?.mortgaged).toBe(true);
    });
    it('keeps get-out-of-jail card out of discard', ()=>{
        const { service } = makeService();
        const out = service.drawCard(getMeta(makeBaseState()), 'chance');
        expect(out.card?.id).toBe(1);
        expect(out.meta.decks.chance.cards.map((c)=>c.id)).toEqual([
            2
        ]);
        expect(out.meta.decks.chance.discard).toEqual([]);
    });
    it('puts normal drawn card in discard', ()=>{
        const { service } = makeService();
        const base = makeBaseState();
        const out1 = service.drawCard(getMeta(base), 'chance');
        const out2 = service.drawCard(out1.meta, 'chance');
        expect(out2.card?.id).toBe(2);
        expect(out2.meta.decks.chance.discard.map((c)=>c.id)).toEqual([
            2
        ]);
    });
    it('handles roll prison variants and triple doubles', ()=>{
        const { service } = makeService([
            4,
            4,
            6,
            6
        ]);
        let state = makeBaseState();
        state = {
            ...state,
            metadata: {
                ...getMeta(state),
                statuses: {
                    ...getMeta(state).statuses,
                    inJail: {
                        ...getMeta(state).statuses.inJail,
                        1: 2
                    }
                }
            }
        };
        const wait = service.handleRoll(state);
        expect(getMeta(wait).statuses.inJail[1]).toBe(1);
        expect(wait.turn?.currentPlayerId).toBe(2);
        state = {
            ...state,
            metadata: {
                ...getMeta(state),
                rules: {
                    ...getMeta(state).rules,
                    jail: {
                        ...getMeta(state).rules.jail,
                        allowDoubleEscape: true
                    }
                },
                statuses: {
                    ...getMeta(state).statuses,
                    inJail: {
                        ...getMeta(state).statuses.inJail,
                        1: 1
                    },
                    consecutiveDoubles: {
                        ...getMeta(state).statuses.consecutiveDoubles,
                        1: 0
                    }
                }
            }
        };
        const escaped = service.handleRoll(state);
        expect(getMeta(escaped).statuses.inJail[1]).toBe(0);
        expect(getMeta(escaped).statuses.extraRoll[1]).toBe(true);
        state = {
            ...makeBaseState(),
            metadata: {
                ...getMeta(makeBaseState()),
                statuses: {
                    ...getMeta(makeBaseState()).statuses,
                    consecutiveDoubles: {
                        ...getMeta(makeBaseState()).statuses.consecutiveDoubles,
                        1: 2
                    }
                }
            }
        };
        const jail = service.handleRoll(state);
        expect(getMeta(jail).statuses.inJail[1]).toBeGreaterThan(0);
    });
    it('opens and resolves choose_property for build/sell/mortgage/unmortgage', ()=>{
        const { service } = makeService();
        let state = makeBaseState();
        state = {
            ...state,
            metadata: {
                ...getMeta(state),
                ownership: {
                    1: 1,
                    3: 1
                }
            }
        };
        const buildPending = service.openChooseProperty(state, 'build');
        expect(buildPending.pending?.type).toBe('choose_property');
        const built = service.handleChooseProperty(buildPending, {
            type: 'choose_property',
            payload: {
                tileIndex: 1
            }
        });
        expect(getMeta(built).buildings[1]?.houses).toBeGreaterThanOrEqual(1);
        const sellPending = service.openChooseProperty({
            ...built,
            pending: null
        }, 'sell_building');
        const sold = service.handleChooseProperty(sellPending, {
            type: 'choose_property',
            payload: {
                tileIndex: 1
            }
        });
        expect(getMeta(sold).buildings[1]?.houses).toBeLessThanOrEqual(getMeta(built).buildings[1]?.houses ?? 0);
        const mortgagePending = service.openChooseProperty({
            ...sold,
            pending: null,
            metadata: {
                ...getMeta(sold),
                buildings: {
                    ...getMeta(sold).buildings,
                    3: {
                        houses: 0,
                        hotel: false,
                        mortgaged: false
                    }
                }
            }
        }, 'mortgage');
        const mortgaged = service.handleChooseProperty(mortgagePending, {
            type: 'choose_property',
            payload: {
                tileIndex: 3
            }
        });
        expect(getMeta(mortgaged).buildings[3]?.mortgaged).toBe(true);
        const unmortgagePending = service.openChooseProperty({
            ...mortgaged,
            pending: null
        }, 'unmortgage');
        const unmortgaged = service.handleChooseProperty(unmortgagePending, {
            type: 'choose_property',
            payload: {
                tileIndex: 3
            }
        });
        expect(getMeta(unmortgaged).buildings[3]?.mortgaged).toBe(false);
    });
    it('applies landing effects across tile types', ()=>{
        const { service } = makeService();
        let state = makeBaseState();
        state = {
            ...state,
            metadata: {
                ...getMeta(state),
                positions: {
                    ...getMeta(state).positions,
                    1: 8
                },
                pot: 150
            }
        };
        const free = service.applyLanding(state, 1);
        expect(getMeta(free).pot).toBe(0);
        state = {
            ...free,
            metadata: {
                ...getMeta(free),
                positions: {
                    ...getMeta(free).positions,
                    1: 4
                }
            }
        };
        const tax = service.applyLanding(state, 1);
        expect(getMeta(tax).pot).toBeGreaterThan(0);
        state = {
            ...tax,
            metadata: {
                ...getMeta(tax),
                positions: {
                    ...getMeta(tax).positions,
                    1: 2
                }
            }
        };
        const chance = service.applyLanding(state, 1);
        expect(chance.log.length).toBeGreaterThan(state.log.length);
        state = {
            ...chance,
            metadata: {
                ...getMeta(chance),
                positions: {
                    ...getMeta(chance).positions,
                    1: 9
                }
            }
        };
        const goJail = service.applyLanding(state, 1);
        expect(getMeta(goJail).statuses.inJail[1]).toBeGreaterThan(0);
        state = {
            ...goJail,
            metadata: {
                ...getMeta(goJail),
                positions: {
                    ...getMeta(goJail).positions,
                    1: 1
                },
                ownership: {
                    ...getMeta(goJail).ownership,
                    1: 2
                }
            }
        };
        const rent = service.applyLanding(state, 1);
        expect(getMeta(rent).money[1]).toBeLessThanOrEqual(getMeta(state).money[1]);
    });
    it('applies card text effects and helper parsers', ()=>{
        const { service } = makeService();
        let state = makeBaseState();
        state = service.applyCard(state, 1, 'chance', {
            id: 10,
            text: 'Tous les joueurs paient 25'
        });
        state = service.applyCard(state, 1, 'chance', {
            id: 11,
            text: 'Tous les joueurs reçoivent 10'
        });
        state = service.applyCard(state, 1, 'chance', {
            id: 12,
            text: 'Vous perdez une infrastructure'
        });
        state = service.applyCard(state, 1, 'chance', {
            id: 13,
            text: 'Avancez de 2 cases'
        });
        state = service.applyCard(state, 1, 'chance', {
            id: 14,
            text: 'Reculez de 1 case'
        });
        state = service.applyCard(state, 1, 'chance', {
            id: 15,
            text: 'Passez votre prochain tour'
        });
        state = service.applyCard(state, 1, 'chance', {
            id: 16,
            text: 'Payez 40'
        });
        state = service.applyCard(state, 1, 'chance', {
            id: 17,
            text: 'Avancez à Gare de Lille'
        });
        state = service.applyCard(state, 1, 'chance', {
            id: 18,
            text: 'Retournez à la case départ'
        });
        state = service.applyCard(state, 1, 'chance', {
            id: 19,
            text: 'Texte sans effet'
        });
        expect(state.log.length).toBeGreaterThan(5);
    });
    it('updates economy helpers, elimination and winner resolution', ()=>{
        const { service } = makeService();
        let state = makeBaseState();
        state = {
            ...state,
            metadata: {
                ...getMeta(state),
                ownership: {
                    1: 1,
                    3: 1,
                    11: 2
                },
                buildings: {
                    1: {
                        houses: 2,
                        hotel: false,
                        mortgaged: false
                    }
                }
            }
        };
        const afterFine = service.addMoney(state, 1, -5000, {
            toPot: true
        });
        expect(getMeta(afterFine).statuses.eliminated[1]).toBe(true);
        expect(getMeta(afterFine).money[1]).toBe(0);
        expect(getMeta(afterFine).ownership[1]).toBeUndefined();
        const withAliveOne = {
            ...afterFine,
            metadata: {
                ...getMeta(afterFine),
                statuses: {
                    ...getMeta(afterFine).statuses,
                    eliminated: {
                        1: true,
                        2: false,
                        3: true
                    }
                }
            }
        };
        const winner = service.checkWinner(withAliveOne);
        expect(getMeta(winner).winnerId).toBe(2);
    });
});
