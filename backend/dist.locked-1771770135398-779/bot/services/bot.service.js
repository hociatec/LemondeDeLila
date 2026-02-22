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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const room_status_constants_1 = require("../../room/constants/room-status.constants");
const room_bot_entity_1 = require("../../room/entities/room-bot.entity");
const room_entity_1 = require("../../room/entities/room.entity");
const room_participant_entity_1 = require("../../room/entities/room-participant.entity");
const bot_name_entity_1 = require("../entities/bot-name.entity");
let BotService = class BotService {
    bots;
    rooms;
    participants;
    botNames;
    cachedEnabledNames = null;
    namesCacheTtlMs;
    constructor(bots, rooms, participants, botNames) {
        this.bots = bots;
        this.rooms = rooms;
        this.participants = participants;
        this.botNames = botNames;
        const ttlCandidate = Number(process.env.BOT_NAMES_CACHE_TTL_MS ?? 30000);
        this.namesCacheTtlMs =
            Number.isFinite(ttlCandidate) && ttlCandidate >= 0 ? ttlCandidate : 30000;
    }
    async addBot(roomId, userId) {
        const room = await this.requireRoomWithOwner(roomId);
        this.ensureOwner(room, userId);
        if (!this.isRoomOpen(room)) {
            throw new common_1.BadRequestException('Table deja demarree');
        }
        const [humans, existingBots] = await Promise.all([
            this.countActiveHumans(room.id),
            this.bots.find({ where: { room: { id: room.id } } }),
        ]);
        const botsCount = existingBots.length;
        if (humans + botsCount >= room.maxPlayers) {
            throw new common_1.BadRequestException('Table pleine');
        }
        const name = await this.pickName(existingBots);
        const bot = this.bots.create({ room, name });
        return this.bots.save(bot);
    }
    async addBotSystem(roomId) {
        const room = await this.rooms.findOne({ where: { id: roomId } });
        if (!room) {
            throw new common_1.NotFoundException('Table introuvable');
        }
        const [humans, existingBots] = await Promise.all([
            this.countActiveHumans(room.id),
            this.bots.find({ where: { room: { id: room.id } } }),
        ]);
        const botsCount = existingBots.length;
        if (humans + botsCount >= room.maxPlayers) {
            throw new common_1.BadRequestException('Table pleine');
        }
        const name = await this.pickName(existingBots);
        const bot = this.bots.create({ room, name });
        return this.bots.save(bot);
    }
    async removeBot(roomId, userId, botId) {
        const room = await this.requireRoomWithOwner(roomId);
        this.ensureOwner(room, userId);
        if (!this.isRoomOpen(room)) {
            const [humans, bots] = await Promise.all([
                this.countActiveHumans(room.id),
                this.countBots(room.id),
            ]);
            if (humans + bots - 1 < 2) {
                throw new common_1.BadRequestException('Impossible de retirer ce bot : au moins deux participants sont requis');
            }
        }
        const bot = await this.bots.findOne({
            where: { id: botId, room: { id: room.id } },
        });
        if (!bot) {
            throw new common_1.NotFoundException('Bot introuvable');
        }
        await this.bots.delete(bot.id);
        return bot;
    }
    async getLastBotForRoom(roomId) {
        return this.bots.findOne({
            where: { room: { id: roomId } },
            order: { id: 'DESC' },
        });
    }
    async statsForRoom(roomId) {
        const total = await this.countBots(roomId);
        return { roomId, total };
    }
    async listBotNames() {
        return this.botNames.find({ order: { name: 'ASC' } });
    }
    async createBotName(name, enabled = true) {
        const sanitized = this.sanitizeName(name);
        if (!sanitized) {
            throw new common_1.BadRequestException('Nom requis');
        }
        const exists = await this.botNames.findOne({ where: { name: sanitized } });
        if (exists) {
            throw new common_1.BadRequestException('Nom déjà utilisé');
        }
        const botName = this.botNames.create({ name: sanitized, enabled });
        const saved = await this.botNames.save(botName);
        this.invalidateBotNamesCache();
        return saved;
    }
    async updateBotName(id, update) {
        const botName = await this.botNames.findOne({ where: { id } });
        if (!botName) {
            throw new common_1.NotFoundException('Bot introuvable');
        }
        if (update.name != null) {
            const sanitized = this.sanitizeName(update.name);
            if (!sanitized) {
                throw new common_1.BadRequestException('Nom requis');
            }
            if (sanitized !== botName.name) {
                const exists = await this.botNames.findOne({
                    where: { name: sanitized },
                });
                if (exists) {
                    throw new common_1.BadRequestException('Nom déjà utilisé');
                }
                botName.name = sanitized;
            }
        }
        if (update.enabled != null) {
            botName.enabled = Boolean(update.enabled);
        }
        const saved = await this.botNames.save(botName);
        this.invalidateBotNamesCache();
        return saved;
    }
    async deleteBotName(id) {
        const botName = await this.botNames.findOne({ where: { id } });
        if (!botName) {
            throw new common_1.NotFoundException('Bot introuvable');
        }
        await this.botNames.delete(botName.id);
        this.invalidateBotNamesCache();
        return botName;
    }
    async pickName(existing) {
        const names = existing.map((b) => b.name.toLowerCase());
        return this.findAvailableName(names);
    }
    sanitizeName(name) {
        const normalized = name.replace(/\s+/g, ' ').trim();
        return normalized.length > 100 ? normalized.slice(0, 100) : normalized;
    }
    async findAvailableName(existing) {
        const exclude = new Set(existing.map((n) => n.toLowerCase()));
        const names = await this.getEnabledNames();
        for (const candidate of names) {
            const sanitized = this.sanitizeName(candidate);
            if (!exclude.has(sanitized.toLowerCase())) {
                return sanitized;
            }
        }
        throw new common_1.BadRequestException('Plus de noms de bots disponibles');
    }
    async getEnabledNames() {
        const cached = this.cachedEnabledNames;
        if (cached &&
            (this.namesCacheTtlMs === 0 || Date.now() < cached.expiresAt)) {
            return this.shuffle(cached.values);
        }
        const rows = await this.botNames.find({
            where: { enabled: true },
            order: { name: 'ASC' },
        });
        if (rows.length === 0) {
            await this.seedDefaultNames();
            const seeded = await this.botNames.find({
                where: { enabled: true },
                order: { name: 'ASC' },
            });
            const values = seeded.map((r) => r.name);
            this.cachedEnabledNames = {
                values,
                expiresAt: this.namesCacheTtlMs === 0
                    ? Number.MAX_SAFE_INTEGER
                    : Date.now() + this.namesCacheTtlMs,
            };
            return this.shuffle(values);
        }
        const values = rows.map((r) => r.name);
        this.cachedEnabledNames = {
            values,
            expiresAt: this.namesCacheTtlMs === 0
                ? Number.MAX_SAFE_INTEGER
                : Date.now() + this.namesCacheTtlMs,
        };
        return this.shuffle(values);
    }
    invalidateBotNamesCache() {
        this.cachedEnabledNames = null;
    }
    async seedDefaultNames() {
        const defaults = ['Lila', 'Cosmo', 'Nova', 'Pixel', 'Orion', 'Echo', 'Bot'];
        const count = await this.botNames.count();
        if (count > 0)
            return;
        const rows = defaults.map((name) => this.botNames.create({ name, enabled: true }));
        await this.botNames.save(rows);
    }
    shuffle(values) {
        const arr = [...values];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
    async countBots(roomId) {
        return this.bots.count({ where: { room: { id: roomId } } });
    }
    async countBotsForRoom(roomId) {
        return this.countBots(roomId);
    }
    async removeAllBotsForRoom(roomId) {
        await this.bots
            .createQueryBuilder()
            .delete()
            .where('room_id = :roomId', { roomId })
            .execute();
    }
    async countActiveHumans(roomId) {
        return this.participants.count({
            where: { room: { id: roomId }, leftAt: (0, typeorm_2.IsNull)() },
        });
    }
    async requireRoomWithOwner(roomId) {
        const room = await this.rooms.findOne({
            where: { id: roomId },
            relations: ['owner'],
        });
        if (!room) {
            throw new common_1.NotFoundException('Table introuvable');
        }
        return room;
    }
    ensureOwner(room, userId) {
        if (!room.owner || room.owner.id !== userId) {
            throw new common_1.UnauthorizedException('Seul le proprietaire peut gerer les bots');
        }
    }
    isRoomOpen(room) {
        const status = (room.status || '').toLowerCase();
        return room_status_constants_1.OPEN_ROOM_STATUSES.includes(status);
    }
};
exports.BotService = BotService;
exports.BotService = BotService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(room_bot_entity_1.RoomBot)),
    __param(1, (0, typeorm_1.InjectRepository)(room_entity_1.Room)),
    __param(2, (0, typeorm_1.InjectRepository)(room_participant_entity_1.RoomParticipant)),
    __param(3, (0, typeorm_1.InjectRepository)(bot_name_entity_1.BotName)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], BotService);
//# sourceMappingURL=bot.service.js.map