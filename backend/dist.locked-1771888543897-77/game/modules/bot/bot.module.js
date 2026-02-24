"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bot_strategy_service_1 = require("./services/bot-strategy.service");
const bot_runner_service_1 = require("./services/bot-runner.service");
const bot_scheduler_service_1 = require("./services/bot-scheduler.service");
const bot_settings_service_1 = require("./services/bot-settings.service");
const bot_settings_entity_1 = require("./entities/bot-settings.entity");
let BotModule = class BotModule {
};
exports.BotModule = BotModule;
exports.BotModule = BotModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([bot_settings_entity_1.BotSettingsEntity])],
        providers: [
            bot_strategy_service_1.BotStrategyService,
            bot_runner_service_1.BotRunnerService,
            bot_scheduler_service_1.BotSchedulerService,
            bot_settings_service_1.BotSettingsService,
        ],
        exports: [
            bot_strategy_service_1.BotStrategyService,
            bot_runner_service_1.BotRunnerService,
            bot_scheduler_service_1.BotSchedulerService,
            bot_settings_service_1.BotSettingsService,
        ],
    })
], BotModule);
//# sourceMappingURL=bot.module.js.map