"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
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
describe('JeuOieService', ()=>{
    it('offers roll only for current player', ()=>{
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
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            metadata: {}
        };
        const actionsA = _rulebook.getAvailableActions(state, 1);
        const actionsB = _rulebook.getAvailableActions(state, 2);
        expect(actionsA.some((a)=>a.type === 'roll')).toBe(true);
        expect(actionsB.some((a)=>a.type === 'roll')).toBe(false);
    });
    it('offers choose_pawn only when selection is pending', ()=>{
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
                },
                {
                    id: 2,
                    username: 'B'
                }
            ],
            pending: {
                type: 'choose_pawn',
                playerId: 2,
                data: {
                    pawns: [
                        {
                            id: 'coq-rockeur'
                        },
                        {
                            id: 'vache-artistique'
                        }
                    ]
                }
            },
            metadata: {}
        };
        const actionsA = _rulebook.getAvailableActions(state, 1);
        const actionsB = _rulebook.getAvailableActions(state, 2);
        expect(actionsA.length).toBe(0);
        expect(actionsB.every((a)=>a.type === 'choose_pawn')).toBe(true);
    });
});
