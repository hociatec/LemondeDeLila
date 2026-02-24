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
exports.StatsWsHandler = void 0;
const common_1 = require("@nestjs/common");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const social_service_1 = require("../../social/services/social.service");
const game_stats_service_1 = require("../services/game-stats.service");
const leaderboard_ws_dto_1 = require("./leaderboard-ws.dto");
const stats_ws_dto_1 = require("./stats-ws.dto");
let StatsWsHandler = class StatsWsHandler {
    stats;
    validator;
    social;
    constructor(stats, validator, social) {
        this.stats = stats;
        this.validator = validator;
        this.social = social;
    }
    async my(session) {
        const user = (0, ws_auth_1.requireUser)(session);
        const games = await this.stats.getMyStats(user.id);
        return { type: 'stats.my', payload: { games } };
    }
    async user(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(stats_ws_dto_1.StatsUserDto, payload);
        const roles = Array.isArray(user.roles) ? user.roles : [];
        const isAdmin = roles.includes('ROLE_ADMIN') || roles.includes('admin');
        if (!isAdmin) {
            const profile = await this.social.getProfile(user.id, dto.userId);
            if (!profile.isOwner && !profile.canView) {
                throw new common_1.HttpException('Profil privé.', 403);
            }
        }
        const games = await this.stats.getMyStats(dto.userId);
        return { type: 'stats.user', payload: { userId: dto.userId, games } };
    }
    async leaderboardGames() {
        const games = await this.stats.getLeaderboardGames();
        return { type: 'leaderboard.games', payload: { games } };
    }
    async leaderboardTop(payload) {
        const dto = this.validator.validate(leaderboard_ws_dto_1.LeaderboardTopDto, payload);
        const entries = await this.stats.getTop10(dto.gameType);
        return {
            type: 'leaderboard.top',
            payload: { gameType: dto.gameType, entries },
        };
    }
};
exports.StatsWsHandler = StatsWsHandler;
exports.StatsWsHandler = StatsWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_stats_service_1.GameStatsService,
        payload_validation_service_1.PayloadValidationService,
        social_service_1.SocialService])
], StatsWsHandler);
//# sourceMappingURL=stats-ws.handler.js.map