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
    it('allows a legal move and switches turn', async ()=>{
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
        const exposed = svc.exposeStateForUser(started, 1);
        expect(exposed.status).toBe('started');
        expect(exposed.extras?.grid?.size).toBeGreaterThan(0);
        const move = (exposed.actions ?? []).find((a)=>a.type === 'corridor_move');
        expect(move).toBeTruthy();
        const next = svc.applyActions(started, [
            {
                type: 'corridor_move',
                payload: move.payload
            }
        ]);
        expect(next.turn?.currentPlayerId).toBe(2);
    });
    it('allows a bot (negative id) to play', async ()=>{
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
        expect(started.status).toBe('started');
        expect(started.turn?.currentPlayerId).toBe(-1);
        const moveTargets = _rulebook.listLegalPawnMoves(started, -1);
        expect(moveTargets.length).toBeGreaterThan(0);
        const next = svc.applyActions(started, [
            {
                type: 'corridor_move',
                payload: {
                    x: moveTargets[0].x,
                    y: moveTargets[0].y
                }
            }
        ]);
        expect(next.turn?.currentPlayerId).toBe(1);
    });
    it('allows placing a wall and decreases remaining walls', async ()=>{
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
        const exposed = svc.exposeStateForUser(started, 1);
        const wall = (exposed.actions ?? []).find((a)=>a.type === 'corridor_place_wall');
        expect(wall).toBeTruthy();
        const before = started.metadata.wallsRemainingByPlayerId['1'];
        const next = svc.applyActions(started, [
            {
                type: 'corridor_place_wall',
                payload: wall.payload
            }
        ]);
        const after = next.metadata.wallsRemainingByPlayerId['1'];
        expect(after).toBe(before - 1);
    });
});
