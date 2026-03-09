"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BotRunnerService", {
    enumerable: true,
    get: function() {
        return BotRunnerService;
    }
});
const _common = require("@nestjs/common");
const _botstrategyservice = require("./bot-strategy.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let BotRunnerService = class BotRunnerService {
    /**
   * Simplifie le choix d'une action : applique le profil, les préférences/fallbacks et retourne 0..1 action.
   */ choose(actions, ctx, profile = 'greedy', opts = {}) {
        return this.strategy.chooseProfile(actions, ctx, profile, opts);
    }
    suggestForHandler(handler, state, botPlayerId) {
        if (!handler) return null;
        if (handler.getBotActions) {
            return handler.getBotActions(state, botPlayerId) ?? null;
        }
        const strategy = handler.getBotStrategy ? handler.getBotStrategy() : null;
        if (strategy?.suggest) {
            return strategy.suggest(state, botPlayerId);
        }
        return null;
    }
    constructor(strategy){
        this.strategy = strategy;
    }
};
BotRunnerService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _botstrategyservice.BotStrategyService === "undefined" ? Object : _botstrategyservice.BotStrategyService
    ])
], BotRunnerService);
