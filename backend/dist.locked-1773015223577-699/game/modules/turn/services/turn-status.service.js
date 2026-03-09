"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TurnStatusService", {
    enumerable: true,
    get: function() {
        return TurnStatusService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let TurnStatusService = class TurnStatusService {
    setStatus(state, playerId, key, value) {
        const metadata = state.metadata;
        const statuses = metadata?.statuses ?? {};
        const playerStatuses = statuses[key] ?? {};
        const updatedStatuses = {
            ...statuses,
            [key]: {
                ...playerStatuses,
                [playerId]: value
            }
        };
        return {
            ...state,
            metadata: {
                ...metadata,
                statuses: updatedStatuses
            }
        };
    }
    getStatus(state, playerId, key) {
        const metadata = state.metadata;
        return metadata?.statuses?.[key]?.[playerId] ?? 0;
    }
    decrement(state, key) {
        const metadata = state.metadata;
        const statuses = metadata?.statuses ?? {};
        const playerStatuses = statuses[key] ?? {};
        const updated = {};
        Object.entries(playerStatuses).forEach(([pid, val])=>{
            const next = Math.max(0, val - 1);
            if (next > 0) updated[pid] = next;
        });
        const merged = {
            ...statuses,
            [key]: updated
        };
        return {
            ...state,
            metadata: {
                ...metadata,
                statuses: merged
            }
        };
    }
};
TurnStatusService = _ts_decorate([
    (0, _common.Injectable)()
], TurnStatusService);
