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
describe('FouleesFantastiquesService', ()=>{
    it('starts with family choice, then enables roll', async ()=>{
        const state = {
            status: 'started',
            phase: 'setup',
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
                type: 'choose_family',
                playerId: 1,
                data: {
                    familyIds: [
                        'equides',
                        'oiseaux'
                    ]
                }
            },
            metadata: {
                familyIdByPlayer: {
                    2: 'equides'
                }
            }
        };
        const actions = _rulebook.getAvailableActions(state, 1);
        expect(actions.map((a)=>a.type)).toContain('choose_family');
        expect(()=>_rulebook.validateAction(state, {
                type: 'choose_family',
                payload: {
                    familyId: 'equides'
                }
            }, 1)).toThrow();
        const validated = _rulebook.validateAction(state, {
            type: 'choose_family',
            payload: {
                familyId: 'oiseaux'
            }
        }, 1);
        expect(validated.type).toBe('choose_family');
        expect(validated.payload?.familyId).toBe('oiseaux');
    });
});
