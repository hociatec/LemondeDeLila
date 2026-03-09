"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "StatsWsHandler", {
    enumerable: true,
    get: function() {
        return StatsWsHandler;
    }
});
const _common = require("@nestjs/common");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _socialservice = require("../../social/services/social.service");
const _gamestatsservice = require("../services/game-stats.service");
const _leaderboardwsdto = require("./leaderboard-ws.dto");
const _statswsdto = require("./stats-ws.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let StatsWsHandler = class StatsWsHandler {
    async my(session) {
        const user = (0, _wsauth.requireUser)(session);
        const games = await this.stats.getMyStats(user.id);
        return {
            type: 'stats.my',
            payload: {
                games
            }
        };
    }
    async user(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_statswsdto.StatsUserDto, payload);
        const roles = Array.isArray(user.roles) ? user.roles : [];
        const isAdmin = roles.includes('ROLE_ADMIN') || roles.includes('admin');
        if (!isAdmin) {
            const profile = await this.social.getProfile(user.id, dto.userId);
            if (!profile.isOwner && !profile.canView) {
                throw new _common.HttpException('Profil privé.', 403);
            }
        }
        const games = await this.stats.getMyStats(dto.userId);
        return {
            type: 'stats.user',
            payload: {
                userId: dto.userId,
                games
            }
        };
    }
    async leaderboardGames() {
        const games = await this.stats.getLeaderboardGames();
        return {
            type: 'leaderboard.games',
            payload: {
                games
            }
        };
    }
    async leaderboardTop(payload) {
        const dto = this.validator.validate(_leaderboardwsdto.LeaderboardTopDto, payload);
        const entries = await this.stats.getTop10(dto.gameType);
        return {
            type: 'leaderboard.top',
            payload: {
                gameType: dto.gameType,
                entries
            }
        };
    }
    constructor(stats, validator, social){
        this.stats = stats;
        this.validator = validator;
        this.social = social;
    }
};
StatsWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamestatsservice.GameStatsService === "undefined" ? Object : _gamestatsservice.GameStatsService,
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _socialservice.SocialService === "undefined" ? Object : _socialservice.SocialService
    ])
], StatsWsHandler);
