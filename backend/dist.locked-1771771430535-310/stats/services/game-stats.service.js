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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var GameStatsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameStatsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const catalog_service_1 = require("../../catalog/services/catalog.service");
const user_entity_1 = require("../../user/entities/user.entity");
const game_match_entity_1 = require("../entities/game-match.entity");
const game_match_player_entity_1 = require("../entities/game-match-player.entity");
let GameStatsService = GameStatsService_1 = class GameStatsService {
    matches;
    players;
    users;
    catalog;
    logger = new common_1.Logger(GameStatsService_1.name);
    constructor(matches, players, users, catalog) {
        this.matches = matches;
        this.players = players;
        this.users = users;
        this.catalog = catalog;
    }
    async startMatch(params) {
        const gameType = (params.gameType ?? '').trim();
        if (!gameType) {
            throw new Error('gameType requis');
        }
        await this.closeActiveMatch(params.roomId, 'restart');
        const match = this.matches.create({
            roomId: params.roomId,
            gameType,
            withBots: params.botsCount > 0,
            botsCount: params.botsCount,
            humansCount: params.humans.length,
            endedAt: null,
            endedReason: null,
            winnerUser: null,
        });
        await this.matches.save(match);
        for (const h of params.humans) {
            const user = await this.users.findOne({ where: { id: h.id } });
            if (!user) {
                continue;
            }
            const row = this.players.create({
                match,
                user,
                username: h.username,
                outcome: 'unknown',
                leftAt: null,
            });
            await this.players.save(row);
        }
        return match;
    }
    async markQuit(roomId, userId) {
        const match = await this.getActiveMatch(roomId);
        if (!match)
            return;
        const row = await this.players.findOne({
            where: { match: { id: match.id }, user: { id: userId } },
        });
        if (!row)
            return;
        if (row.outcome === 'won' ||
            row.outcome === 'lost' ||
            row.outcome === 'draw') {
            return;
        }
        row.outcome = 'quit';
        row.leftAt = row.leftAt ?? new Date();
        await this.players.save(row);
    }
    async endMatchOnReset(roomId) {
        await this.closeActiveMatch(roomId, 'reset');
    }
    async finalizeFinished(roomId, state) {
        const match = await this.getActiveMatch(roomId);
        if (!match)
            return;
        const winnerRaw = state.metadata?.winnerId ?? null;
        const winnerId = typeof winnerRaw === 'number' ? winnerRaw : null;
        const cooperative = typeof winnerRaw === 'string' && winnerRaw.trim() !== '';
        match.endedAt = new Date();
        match.endedReason = 'finished';
        match.winnerUser =
            winnerId != null
                ? await this.users.findOne({ where: { id: winnerId } })
                : null;
        await this.matches.save(match);
        const rows = await this.players.find({
            where: { match: { id: match.id } },
        });
        for (const row of rows) {
            if (row.outcome === 'quit') {
                continue;
            }
            row.outcome = this.resolveOutcome(row.user?.id ?? 0, winnerId, cooperative);
            await this.players.save(row);
        }
    }
    async getMyStats(userId) {
        const rows = await this.players.find({
            where: { user: { id: userId } },
            relations: ['match'],
        });
        const byGame = new Map();
        for (const r of rows) {
            const match = r.match;
            if (!match)
                continue;
            const key = match.gameType;
            if (!byGame.has(key)) {
                byGame.set(key, {
                    withBots: { finished: 0, quit: 0, won: 0, lost: 0 },
                    withoutBots: { finished: 0, quit: 0, won: 0, lost: 0 },
                });
            }
            const bucket = byGame.get(key);
            const target = match.withBots ? bucket.withBots : bucket.withoutBots;
            if (r.outcome === 'quit') {
                target.quit += 1;
                continue;
            }
            if (match.endedAt) {
                target.finished += 1;
            }
            if (r.outcome === 'won')
                target.won += 1;
            if (r.outcome === 'lost')
                target.lost += 1;
        }
        const results = [];
        for (const [gameType, counts] of byGame.entries()) {
            const manifest = await this.catalog.getGame(gameType);
            results.push({
                gameType,
                gameName: manifest?.name ?? gameType,
                withBots: counts.withBots,
                withoutBots: counts.withoutBots,
            });
        }
        results.sort((a, b) => a.gameName.localeCompare(b.gameName, 'fr'));
        return results;
    }
    async getLeaderboardGames() {
        const rows = await this.matches
            .createQueryBuilder('m')
            .select('DISTINCT m.game_type', 'gameType')
            .where('m.ended_at IS NOT NULL')
            .orderBy('m.game_type', 'ASC')
            .getRawMany();
        const list = [];
        for (const r of rows) {
            const gameType = String(r.gameType ?? '').trim();
            if (!gameType)
                continue;
            const manifest = await this.catalog.getGame(gameType);
            list.push({ gameType, gameName: manifest?.name ?? gameType });
        }
        list.sort((a, b) => a.gameName.localeCompare(b.gameName, 'fr'));
        return list;
    }
    async getTop10(gameType) {
        const normalized = (gameType ?? '').trim();
        if (!normalized)
            return [];
        const rows = await this.players
            .createQueryBuilder('p')
            .innerJoin('p.match', 'm')
            .select('p.user_id', 'userId')
            .addSelect('MAX(p.username)', 'username')
            .addSelect("SUM(CASE WHEN p.outcome = 'won' THEN 1 ELSE 0 END)", 'wins')
            .addSelect("SUM(CASE WHEN p.outcome = 'lost' THEN 1 ELSE 0 END)", 'losses')
            .addSelect("SUM(CASE WHEN p.outcome IN ('won','lost','draw') THEN 1 ELSE 0 END)", 'finished')
            .addSelect("SUM(CASE WHEN p.outcome = 'quit' THEN 1 ELSE 0 END)", 'quit')
            .where('m.game_type = :gameType', { gameType: normalized })
            .andWhere('m.ended_reason = :reason', { reason: 'finished' })
            .groupBy('p.user_id')
            .orderBy('wins', 'DESC')
            .addOrderBy('finished', 'DESC')
            .addOrderBy('losses', 'ASC')
            .limit(10)
            .getRawMany();
        return rows.map((r) => ({
            userId: Number(r.userId),
            username: String(r.username ?? ''),
            wins: Number(r.wins ?? 0),
            losses: Number(r.losses ?? 0),
            finished: Number(r.finished ?? 0),
            quit: Number(r.quit ?? 0),
        }));
    }
    resolveOutcome(userId, winnerId, cooperative) {
        if (cooperative) {
            return 'won';
        }
        if (winnerId == null) {
            return 'lost';
        }
        return userId === winnerId ? 'won' : 'lost';
    }
    async getActiveMatch(roomId) {
        return await this.matches.findOne({
            where: { roomId, endedAt: (0, typeorm_2.IsNull)() },
            order: { startedAt: 'DESC' },
            relations: ['winnerUser'],
        });
    }
    async closeActiveMatch(roomId, reason) {
        const match = await this.getActiveMatch(roomId);
        if (!match)
            return;
        match.endedAt = new Date();
        match.endedReason = reason;
        match.winnerUser = null;
        await this.matches.save(match);
        const rows = await this.players.find({
            where: { match: { id: match.id } },
        });
        for (const row of rows) {
            if (row.outcome === 'won' ||
                row.outcome === 'lost' ||
                row.outcome === 'draw') {
                continue;
            }
            row.outcome = 'quit';
            row.leftAt = row.leftAt ?? new Date();
            await this.players.save(row);
        }
        this.logger.warn(`Match actif clos (roomId=${roomId}, reason=${reason})`);
    }
    async resetAllStats() {
        const deletedPlayers = await this.players
            .createQueryBuilder()
            .delete()
            .execute();
        const deletedMatches = await this.matches
            .createQueryBuilder()
            .delete()
            .execute();
        return {
            deletedPlayers: deletedPlayers.affected ?? 0,
            deletedMatches: deletedMatches.affected ?? 0,
        };
    }
};
exports.GameStatsService = GameStatsService;
exports.GameStatsService = GameStatsService = GameStatsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(game_match_entity_1.GameMatch)),
    __param(1, (0, typeorm_1.InjectRepository)(game_match_player_entity_1.GameMatchPlayer)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        catalog_service_1.CatalogService])
], GameStatsService);
//# sourceMappingURL=game-stats.service.js.map