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
exports.AdminStatsWsHandler = void 0;
const common_1 = require("@nestjs/common");
const ws_auth_1 = require("../../common/ws/ws-auth");
const game_stats_service_1 = require("../../stats/services/game-stats.service");
let AdminStatsWsHandler = class AdminStatsWsHandler {
    stats;
    constructor(stats) {
        this.stats = stats;
    }
    async statsResetAll(session) {
        (0, ws_auth_1.requireAdmin)(session);
        const { deletedPlayers, deletedMatches } = await this.stats.resetAllStats();
        return {
            type: 'admin.stats.resetAll',
            payload: { ok: true, deletedPlayers, deletedMatches },
        };
    }
};
exports.AdminStatsWsHandler = AdminStatsWsHandler;
exports.AdminStatsWsHandler = AdminStatsWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_stats_service_1.GameStatsService])
], AdminStatsWsHandler);
//# sourceMappingURL=admin-stats-ws.handler.js.map