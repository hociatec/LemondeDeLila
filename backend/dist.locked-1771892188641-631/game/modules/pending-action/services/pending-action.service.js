"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingActionService = void 0;
exports.createPendingState = createPendingState;
exports.clearPendingState = clearPendingState;
exports.resolvePendingState = resolvePendingState;
exports.getPendingType = getPendingType;
exports.isPendingType = isPendingType;
const common_1 = require("@nestjs/common");
function createPendingState(state, pending) {
    return {
        ...state,
        pending: { ...pending },
    };
}
function clearPendingState(state) {
    return {
        ...state,
        pending: null,
    };
}
function resolvePendingState(state, resolver) {
    const pending = state.pending;
    if (!pending)
        return state;
    return resolver(clearPendingState(state), pending);
}
function getPendingType(state) {
    return String(state.pending?.type ?? '').trim();
}
function isPendingType(state, type) {
    return getPendingType(state) === String(type ?? '').trim();
}
let PendingActionService = class PendingActionService {
    pending = {};
    set(playerId, action) {
        this.pending[playerId] = action;
    }
    get(playerId) {
        return this.pending[playerId];
    }
    clear(playerId) {
        delete this.pending[playerId];
    }
};
exports.PendingActionService = PendingActionService;
exports.PendingActionService = PendingActionService = __decorate([
    (0, common_1.Injectable)()
], PendingActionService);
//# sourceMappingURL=pending-action.service.js.map