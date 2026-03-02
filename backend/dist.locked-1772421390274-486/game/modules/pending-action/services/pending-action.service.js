"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get PendingActionService () {
        return PendingActionService;
    },
    get clearPendingState () {
        return clearPendingState;
    },
    get createPendingState () {
        return createPendingState;
    },
    get getPendingType () {
        return getPendingType;
    },
    get isPendingType () {
        return isPendingType;
    },
    get resolvePendingState () {
        return resolvePendingState;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function createPendingState(state, pending) {
    return {
        ...state,
        pending: {
            ...pending
        }
    };
}
function clearPendingState(state) {
    return {
        ...state,
        pending: null
    };
}
function resolvePendingState(state, resolver) {
    const pending = state.pending;
    if (!pending) return state;
    return resolver(clearPendingState(state), pending);
}
function getPendingType(state) {
    return String(state.pending?.type ?? '').trim();
}
function isPendingType(state, type) {
    return getPendingType(state) === String(type ?? '').trim();
}
let PendingActionService = class PendingActionService {
    set(playerId, action) {
        this.pending[playerId] = action;
    }
    get(playerId) {
        return this.pending[playerId];
    }
    clear(playerId) {
        delete this.pending[playerId];
    }
    constructor(){
        this.pending = {};
    }
};
PendingActionService = _ts_decorate([
    (0, _common.Injectable)()
], PendingActionService);
