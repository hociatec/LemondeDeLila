"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const room_module_1 = require("../../room/room.module");
const core_module_1 = require("../core/core.module");
const bot_module_1 = require("../modules/bot/bot.module");
const grid_module_1 = require("../modules/grid/grid.module");
const turn_module_1 = require("../modules/turn/turn.module");
const game_registry_module_1 = require("./game-registry.module");
const game_engine_service_1 = require("./services/game-engine.service");
const game_engine_state_store_1 = require("./services/game-engine-state.store");
const game_content_service_1 = require("./services/game-content.service");
const game_gateway_1 = require("./gateways/game.gateway");
const engine_services_module_1 = require("./services/engine-services.module");
const stats_module_1 = require("../../stats/stats.module");
const client_updates_module_1 = require("../../client-updates/client-updates.module");
let EngineModule = class EngineModule {
};
exports.EngineModule = EngineModule;
exports.EngineModule = EngineModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            room_module_1.RoomModule,
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            bot_module_1.BotModule,
            grid_module_1.GridModule,
            turn_module_1.TurnModule,
            engine_services_module_1.EngineServicesModule,
            stats_module_1.StatsModule,
            client_updates_module_1.ClientUpdatesModule,
        ],
        providers: [
            game_engine_service_1.GameEngineService,
            game_engine_state_store_1.GameEngineStateStore,
            game_content_service_1.GameContentService,
            game_gateway_1.GameGateway,
        ],
        exports: [game_engine_service_1.GameEngineService, engine_services_module_1.EngineServicesModule],
    })
], EngineModule);
//# sourceMappingURL=engine.module.js.map