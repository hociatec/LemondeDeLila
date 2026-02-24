"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotRunnerService = void 0;
const common_1 = require("@nestjs/common");
const bot_strategy_service_1 = require("./bot-strategy.service");
let BotRunnerService = class BotRunnerService {
    strategy;
    constructor(strategy) {
        this.strategy = strategy;
    }
    choose(actions, ctx, profile = 'greedy', opts = {}) {
        return this.strategy.chooseProfile(actions, ctx, profile, opts);
    }
    suggestForHandler(handler, state, botPlayerId) {
        if (!handler)
            return null;
        if (handler.getBotActions) {
            return handler.getBotActions(state, botPlayerId) ?? null;
        }
        const strategy = handler.getBotStrategy ? handler.getBotStrategy() : null;
        if (strategy?.suggest) {
            return strategy.suggest(state, botPlayerId);
        }
        return null;
    }
};
exports.BotRunnerService = BotRunnerService;
exports.BotRunnerService = BotRunnerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [bot_strategy_service_1.BotStrategyService])
], BotRunnerService);
//# sourceMappingURL=bot-runner.service.js.map