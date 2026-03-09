"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminStatsWsHandler", {
    enumerable: true,
    get: function() {
        return AdminStatsWsHandler;
    }
});
const _common = require("@nestjs/common");
const _wsauth = require("../../common/ws/ws-auth");
const _gamestatsservice = require("../../stats/services/game-stats.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AdminStatsWsHandler = class AdminStatsWsHandler {
    async statsResetAll(session) {
        (0, _wsauth.requireAdmin)(session);
        const { deletedPlayers, deletedMatches } = await this.stats.resetAllStats();
        return {
            type: 'admin.stats.resetAll',
            payload: {
                ok: true,
                deletedPlayers,
                deletedMatches
            }
        };
    }
    constructor(stats){
        this.stats = stats;
    }
};
AdminStatsWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamestatsservice.GameStatsService === "undefined" ? Object : _gamestatsservice.GameStatsService
    ])
], AdminStatsWsHandler);
