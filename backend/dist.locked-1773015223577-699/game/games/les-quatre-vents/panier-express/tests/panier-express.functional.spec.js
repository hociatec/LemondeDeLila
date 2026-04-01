"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _fs = require("fs");
const _path = require("path");
const _panierexpressservice = require("../panier-express.service");
const _panierexpressexchangeservice = require("../actions/panier-express-exchange.service");
const _panierexpresstestharness = require("./panier-express-test-harness");
function loadContentArray(filename, key) {
    const fullPath = (0, _path.join)(__dirname, '..', 'model', 'content', filename);
    const raw = (0, _fs.readFileSync)(fullPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed[key]) ? parsed[key] : [];
}
function makeStartedState(game, players, currentPlayerId, seed) {
    const state = game.hydrateInitialState({
        players,
        status: 'running'
    });
    state.status = 'started';
    state.turn = {
        currentPlayerId,
        direction: 1
    };
    state.turnIndex = Math.max(0, players.findIndex((p)=>p.id === currentPlayerId));
    state.pending = null;
    state.metadata = {
        ...state.metadata ?? {},
        rng: {
            seed,
            counter: 0
        }
    };
    return state;
}
function resolveBlockingPending(game, state, maxSteps = 20) {
    let next = state;
    for(let i = 0; i < maxSteps; i += 1){
        if (!next.pending) return next;
        const pending = next.pending;
        if (!pending.blocking) return next;
        const actorId = typeof pending.playerId === 'number' ? pending.playerId : next.turn?.currentPlayerId ?? null;
        if (typeof actorId !== 'number') {
            throw new Error('pending bloquant sans playerId ni currentPlayerId');
        }
        const actor = (next.players ?? []).find((p)=>p.id === actorId);
        const botActions = actor?.isBot ? game.getBotActions(next, actorId) : [];
        const actions = botActions.length > 0 ? botActions : game.getAvailableActions(next, actorId);
        if (!actions.length) {
            throw new Error(`Aucune action disponible pour résoudre le pending (type=${pending.type}, kind=${pending?.data?.kind ?? ''}).`);
        }
        next = game.applyActions(next, actions.slice(0, 1).map((a)=>({
                ...a,
                meta: {
                    actorId
                }
            })));
    }
    throw new Error('pending bloquant non résolu (limite atteinte)');
}
describe('PanierExpress - tests fonctionnels (simulation)', ()=>{
    let game;
    let exchange;
    beforeAll(async ()=>{
        const moduleRef = await (0, _panierexpresstestharness.createPanierExpressTestingModule)();
        game = moduleRef.get(_panierexpressservice.PanierExpressService);
        exchange = moduleRef.get(_panierexpressexchangeservice.PanierExpressExchangeService);
    });
    it('résout chaque carte événement (sans crash + pending bloquants résolubles)', ()=>{
        const events = loadContentArray('events.json', 'events');
        for (const card of events){
            const base = makeStartedState(game, [
                {
                    id: 1,
                    username: 'A',
                    inventory: [
                        'pomme'
                    ],
                    basket: [],
                    shoppingList: []
                },
                {
                    id: 2,
                    username: 'B',
                    inventory: [
                        'poire'
                    ],
                    basket: [],
                    shoppingList: []
                }
            ], 1, 1);
            base.metadata.decks.events = {
                deck: [
                    card
                ],
                discards: []
            };
            base.metadata.decks['courses-bonus'] = {
                deck: [
                    'amande',
                    'noix',
                    'pomme',
                    'banane',
                    'fraise',
                    'melon'
                ],
                discards: []
            };
            const afterEvent = game.applyEvent(base, 1);
            const afterPending = resolveBlockingPending(game, afterEvent, 25);
            expect(afterPending).toBeTruthy();
        }
    });
    it('résout chaque carte échange (sans crash + pending bloquants résolubles)', ()=>{
        const exchanges = loadContentArray('exchanges.json', 'exchanges');
        for (const card of exchanges){
            const base = makeStartedState(game, [
                {
                    id: 1,
                    username: 'A',
                    inventory: [
                        'pomme',
                        'banane'
                    ],
                    basket: [],
                    shoppingList: []
                },
                {
                    id: 2,
                    username: 'B',
                    inventory: [
                        'poire',
                        'kiwi'
                    ],
                    basket: [],
                    shoppingList: []
                }
            ], 1, 2);
            const meta = base.metadata;
            const exchangeIndex = (meta.tiles ?? []).findIndex((t)=>t?.type === 'exchange');
            meta.positions[1] = exchangeIndex >= 0 ? exchangeIndex : 0;
            meta.decks.exchanges = {
                deck: [
                    card
                ],
                discards: []
            };
            const after = exchange.applyExchange(base, 1);
            const afterPending = resolveBlockingPending(game, after, 25);
            expect(afterPending).toBeTruthy();
        }
    });
    it('simule une partie jouée (actions rulebook) sans deadlock', ()=>{
        let state = makeStartedState(game, [
            {
                id: 1,
                username: 'Nuggets',
                isBot: true,
                inventory: [],
                basket: [],
                shoppingList: [
                    'pomme'
                ]
            },
            {
                id: 2,
                username: 'Humain',
                inventory: [],
                basket: [],
                shoppingList: [
                    'poire'
                ]
            }
        ], 1, 3);
        const maxActions = 800;
        let unchangedStreak = 0;
        for(let i = 0; i < maxActions; i += 1){
            if ((state.status || '').toLowerCase() === 'finished') break;
            const pending = state.pending;
            const actorId = typeof pending?.playerId === 'number' ? pending.playerId : state.turn?.currentPlayerId ?? null;
            if (typeof actorId !== 'number') {
                throw new Error('Partie sans actorId (ni pending.playerId, ni currentPlayerId)');
            }
            const actor = (state.players ?? []).find((p)=>p.id === actorId);
            const botActions = actor?.isBot ? game.getBotActions(state, actorId) : [];
            const actions = botActions.length > 0 ? botActions : game.getAvailableActions(state, actorId);
            if (!actions.length) {
                throw new Error(`Deadlock: aucune action disponible (turn=${state.turn?.currentPlayerId ?? 'null'}, pending=${pending?.type ?? 'null'}).`);
            }
            const before = JSON.stringify({
                status: state.status,
                turn: state.turn,
                pending: state.pending,
                positions: state.metadata?.positions,
                laps: state.metadata?.laps,
                rng: state.metadata?.rng
            });
            state = game.applyActions(state, [
                {
                    ...actions[0],
                    meta: {
                        actorId
                    }
                }
            ]);
            const after = JSON.stringify({
                status: state.status,
                turn: state.turn,
                pending: state.pending,
                positions: state.metadata?.positions,
                laps: state.metadata?.laps,
                rng: state.metadata?.rng
            });
            if (after === before) {
                unchangedStreak += 1;
            } else {
                unchangedStreak = 0;
            }
            expect(unchangedStreak).toBeLessThan(40);
        }
        expect(state).toBeTruthy();
    });
});
