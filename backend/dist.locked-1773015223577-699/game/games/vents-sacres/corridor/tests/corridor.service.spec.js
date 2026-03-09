"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _corridorservice = require("../corridor.service");
const _corridorsetupservice = require("../setup/corridor-setup.service");
const _corridoractionservice = require("../actions/corridor-action.service");
const _corridorpresenterservice = require("../presenter/corridor-presenter.service");
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
function createSvc() {
    const presenter = new _corridorpresenterservice.CorridorPresenterService({
        buildFromWalls: ()=>({})
    }, {
        buildFromActions: ()=>({})
    });
    return new _corridorservice.CorridorService({
        register: ()=>{}
    }, new _corridorsetupservice.CorridorSetupService(), new _corridoractionservice.CorridorActionService(), presenter, undefined);
}
function choosePawnForUser(svc, state, userId) {
    const exposed = svc.exposeStateForUser(state, userId);
    const chooseAction = (exposed.actions ?? []).find((a)=>a.type === 'choose_pawn');
    if (!chooseAction) return state;
    return svc.applyActions(state, [
        chooseAction
    ]);
}
describe('Corridor', ()=>{
    it('does not auto-start from setup', async ()=>{
        const svc = createSvc();
        const base = {
            status: 'setup',
            phase: 'setup',
            round: 0,
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
            metadata: {},
            pending: null
        };
        const state = svc.hydrateInitialState(base);
        expect(state.status).toBe('setup');
        const exposed = svc.exposeStateForUser(state, 1);
        expect(exposed.extras?.grid).toBeUndefined();
    });
    it('requires pawn selection before exposing move/wall actions', async ()=>{
        const svc = createSvc();
        const started = svc.hydrateInitialState({
            status: 'started',
            phase: 'setup',
            round: 0,
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
                    username: 'Lilas'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            metadata: {},
            pending: null
        });
        const exposed1 = svc.exposeStateForUser(started, 1);
        const exposed2 = svc.exposeStateForUser(started, 2);
        const types1 = new Set((exposed1.actions ?? []).map((a)=>a.type));
        const types2 = new Set((exposed2.actions ?? []).map((a)=>a.type));
        expect(types1.has('choose_pawn') || types2.has('choose_pawn')).toBe(true);
        expect(types1.has('corridor_move')).toBe(false);
        expect(types1.has('corridor_place_wall')).toBe(false);
        expect(types2.has('corridor_move')).toBe(false);
        expect(types2.has('corridor_place_wall')).toBe(false);
    });
    it('exposes choose_pawn pending only to the targeted human player', async ()=>{
        const svc = createSvc();
        const started = svc.hydrateInitialState({
            status: 'started',
            phase: 'setup',
            round: 0,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: -1,
                    username: 'Bot',
                    isBot: true
                },
                {
                    id: 1,
                    username: 'Human',
                    isBot: false
                }
            ],
            turn: {
                currentPlayerId: -1,
                direction: 1
            },
            metadata: {},
            pending: null
        });
        const forHuman = svc.exposeStateForUser(started, 1);
        expect(forHuman.pending?.type).toBe('choose_pawn');
        expect(forHuman.pending?.playerId).toBe(1);
        expect((forHuman.pending?.data?.pawns ?? []).length).toBeGreaterThan(0);
        const forBot = svc.exposeStateForUser(started, -1);
        expect(forBot.pending).toBeNull();
    });
    it('allows a legal move and switches turn after pawn choices', async ()=>{
        const svc = createSvc();
        const base = {
            status: 'started',
            phase: 'setup',
            round: 0,
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
            metadata: {},
            pending: null
        };
        const started = svc.hydrateInitialState(base);
        // Pawn choice order is randomized; attempt for both players until pending clears.
        let ready = started;
        ready = choosePawnForUser(svc, ready, 1);
        ready = choosePawnForUser(svc, ready, 2);
        ready = choosePawnForUser(svc, ready, 1);
        ready = choosePawnForUser(svc, ready, 2);
        const exposed = svc.exposeStateForUser(ready, 1);
        expect(exposed.status).toBe('started');
        expect(exposed.extras?.grid?.size).toBeGreaterThan(0);
        const move = (exposed.actions ?? []).find((a)=>a.type === 'corridor_move');
        expect(move).toBeTruthy();
        const next = svc.applyActions(ready, [
            {
                type: 'corridor_move',
                payload: move.payload
            }
        ]);
        expect(next.turn?.currentPlayerId).toBe(2);
    });
    it('auto-assigns bot pawn then waits for human pawn choice', async ()=>{
        const svc = createSvc();
        const base = {
            status: 'started',
            phase: 'setup',
            round: 0,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: -1,
                    username: 'Bot',
                    isBot: true
                },
                {
                    id: 1,
                    username: 'Human',
                    isBot: false
                }
            ],
            turn: {
                currentPlayerId: -1,
                direction: 1
            },
            metadata: {},
            pending: null
        };
        const started = svc.hydrateInitialState(base);
        expect(started.pending?.type).toBe('choose_pawn');
        expect(started.pending?.playerId).toBe(1);
        expect(started.metadata?.pawnByPlayerId?.['-1']).toBeTruthy();
        const ready = choosePawnForUser(svc, started, 1);
        expect(ready.pending).toBeNull();
        expect(ready.turn?.currentPlayerId).toBe(-1);
    });
    it('does not finish on a non-winning move when legacy winner metadata exists', async ()=>{
        const svc = createSvc();
        const base = {
            status: 'started',
            phase: 'setup',
            round: 0,
            turnIndex: 0,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: -1,
                    username: 'Bot',
                    isBot: true
                },
                {
                    id: 1,
                    username: 'Human',
                    isBot: false
                }
            ],
            turn: {
                currentPlayerId: -1,
                direction: 1
            },
            metadata: {
                winnerId: -1,
                winnerPlayerId: -1,
                finishedAt: '2026-03-01T12:00:00.000Z',
                outcomesByPlayerId: {
                    '-1': 'won',
                    '1': 'lost'
                }
            },
            pending: null
        };
        const started = svc.hydrateInitialState(base);
        const afterChoose = choosePawnForUser(svc, started, 1);
        const ready = {
            ...afterChoose,
            turn: {
                ...afterChoose.turn ?? {},
                currentPlayerId: -1
            }
        };
        const moveTargets = _rulebook.listLegalPawnMoves(ready, -1);
        const nonWinning = moveTargets.find((m)=>m.y !== 0) ?? moveTargets[0];
        expect(nonWinning).toBeTruthy();
        const next = svc.applyActions(ready, [
            {
                type: 'corridor_move',
                payload: {
                    x: nonWinning.x,
                    y: nonWinning.y
                }
            }
        ]);
        expect(String(next.status)).toBe('started');
        expect(next.metadata.winnerId).toBeNull();
        expect(next.metadata.winnerPlayerId).toBeNull();
        expect(next.metadata.finishedAt).toBeUndefined();
    });
    it('does not declare victory on horizontal move when player goal is opposite row', async ()=>{
        const svc = createSvc();
        const state = {
            status: 'started',
            phase: 'play',
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
                    id: -1,
                    username: 'Milou',
                    isBot: true
                }
            ],
            turn: {
                currentPlayerId: -1,
                direction: 1
            },
            metadata: {
                size: 9,
                pawnsByPlayerId: {
                    '-1': {
                        x: 4,
                        y: 0
                    },
                    '1': {
                        x: 4,
                        y: 8
                    }
                },
                goalYByPlayerId: {
                    '-1': 8,
                    '1': 0
                },
                walls: {
                    h: [],
                    v: []
                },
                wallsRemainingByPlayerId: {
                    '-1': 10,
                    '1': 10
                },
                winnerId: null,
                winnerPlayerId: null
            },
            pending: null
        };
        const next = svc.applyActions(state, [
            {
                type: 'corridor_move',
                payload: {
                    x: 5,
                    y: 0
                }
            }
        ]);
        expect(String(next.status)).toBe('started');
        expect(next.metadata.winnerId).toBeNull();
        expect(next.metadata.winnerPlayerId).toBeNull();
    });
    it('allows placing a wall and decreases remaining walls after pawn choices', async ()=>{
        const svc = createSvc();
        const base = {
            status: 'started',
            phase: 'setup',
            round: 0,
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
            metadata: {},
            pending: null
        };
        // Pawn choice order is randomized; attempt for both players until pending clears.
        let ready = svc.hydrateInitialState(base);
        ready = choosePawnForUser(svc, ready, 1);
        ready = choosePawnForUser(svc, ready, 2);
        ready = choosePawnForUser(svc, ready, 1);
        ready = choosePawnForUser(svc, ready, 2);
        const exposed = svc.exposeStateForUser(ready, 1);
        const wall = (exposed.actions ?? []).find((a)=>a.type === 'corridor_place_wall');
        expect(wall).toBeTruthy();
        const before = ready.metadata.wallsRemainingByPlayerId['1'];
        const next = svc.applyActions(ready, [
            {
                type: 'corridor_place_wall',
                payload: wall.payload
            }
        ]);
        const after = next.metadata.wallsRemainingByPlayerId['1'];
        expect(after).toBe(before - 1);
    });
});
