"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GenericExchangeService", {
    enumerable: true,
    get: function() {
        return GenericExchangeService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let GenericExchangeService = class GenericExchangeService {
    buildActions(state, playerId, inventoryKey = 'inventory') {
        const players = state.players ?? [];
        const self = players.find((p)=>p.id === playerId);
        if (!self || !self[inventoryKey]?.length) return [];
        const actions = [];
        players.forEach((p)=>{
            if (p.id === playerId) return;
            const targetInv = p[inventoryKey] ?? [];
            if (!targetInv.length) return;
            self[inventoryKey].forEach((give)=>{
                targetInv.forEach((take)=>{
                    actions.push({
                        give,
                        take
                    });
                });
            });
        });
        return actions;
    }
};
GenericExchangeService = _ts_decorate([
    (0, _common.Injectable)()
], GenericExchangeService);
