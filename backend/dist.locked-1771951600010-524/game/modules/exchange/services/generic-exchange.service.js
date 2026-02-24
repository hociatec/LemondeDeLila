"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericExchangeService = void 0;
const common_1 = require("@nestjs/common");
let GenericExchangeService = class GenericExchangeService {
    buildActions(state, playerId, inventoryKey = 'inventory') {
        const players = state.players ?? [];
        const self = players.find((p) => p.id === playerId);
        if (!self || !self[inventoryKey]?.length)
            return [];
        const actions = [];
        players.forEach((p) => {
            if (p.id === playerId)
                return;
            const targetInv = p[inventoryKey] ?? [];
            if (!targetInv.length)
                return;
            self[inventoryKey].forEach((give) => {
                targetInv.forEach((take) => {
                    actions.push({ give, take });
                });
            });
        });
        return actions;
    }
};
exports.GenericExchangeService = GenericExchangeService;
exports.GenericExchangeService = GenericExchangeService = __decorate([
    (0, common_1.Injectable)()
], GenericExchangeService);
//# sourceMappingURL=generic-exchange.service.js.map