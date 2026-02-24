"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const catalog_module_1 = require("../catalog/catalog.module");
const social_module_1 = require("../social/social.module");
const user_entity_1 = require("../user/entities/user.entity");
const game_match_entity_1 = require("./entities/game-match.entity");
const game_match_player_entity_1 = require("./entities/game-match-player.entity");
const game_stats_service_1 = require("./services/game-stats.service");
const stats_ws_handler_1 = require("./ws/stats-ws.handler");
const stats_ws_registrar_1 = require("./ws/stats-ws.registrar");
let StatsModule = class StatsModule {
};
exports.StatsModule = StatsModule;
exports.StatsModule = StatsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([game_match_entity_1.GameMatch, game_match_player_entity_1.GameMatchPlayer, user_entity_1.User]),
            catalog_module_1.CatalogModule,
            social_module_1.SocialModule,
        ],
        providers: [game_stats_service_1.GameStatsService, stats_ws_handler_1.StatsWsHandler, stats_ws_registrar_1.StatsWsRegistrar],
        exports: [game_stats_service_1.GameStatsService],
    })
], StatsModule);
//# sourceMappingURL=stats.module.js.map