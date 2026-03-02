"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BotService", {
    enumerable: true,
    get: function() {
        return BotService;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _roomstatusconstants = require("../../room/constants/room-status.constants");
const _roombotentity = require("../../room/entities/room-bot.entity");
const _roomentity = require("../../room/entities/room.entity");
const _roomparticipantentity = require("../../room/entities/room-participant.entity");
const _botnameentity = require("../entities/bot-name.entity");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let BotService = class BotService {
    async addBot(roomId, userId) {
        const room = await this.requireRoomWithOwner(roomId);
        this.ensureOwner(room, userId);
        if (!this.isRoomOpen(room)) {
            throw new _common.BadRequestException('Table deja demarree');
        }
        const [humans, existingBots] = await Promise.all([
            this.countActiveHumans(room.id),
            this.bots.find({
                where: {
                    room: {
                        id: room.id
                    }
                }
            })
        ]);
        const botsCount = existingBots.length;
        if (humans + botsCount >= room.maxPlayers) {
            throw new _common.BadRequestException('Table pleine');
        }
        const name = await this.pickName(existingBots);
        const bot = this.bots.create({
            room,
            name
        });
        return this.bots.save(bot);
    }
    /**
   * Ajout système d'un bot (sans droits owner) pour maintenir une table jouable.
   * - Autorisé même si la table a démarré
   * - Respecte maxPlayers (humains actifs + bots)
   */ async addBotSystem(roomId) {
        const room = await this.rooms.findOne({
            where: {
                id: roomId
            }
        });
        if (!room) {
            throw new _common.NotFoundException('Table introuvable');
        }
        const [humans, existingBots] = await Promise.all([
            this.countActiveHumans(room.id),
            this.bots.find({
                where: {
                    room: {
                        id: room.id
                    }
                }
            })
        ]);
        const botsCount = existingBots.length;
        if (humans + botsCount >= room.maxPlayers) {
            throw new _common.BadRequestException('Table pleine');
        }
        const name = await this.pickName(existingBots);
        const bot = this.bots.create({
            room,
            name
        });
        return this.bots.save(bot);
    }
    async removeBot(roomId, userId, botId) {
        const room = await this.requireRoomWithOwner(roomId);
        this.ensureOwner(room, userId);
        // Autoriser le retrait d'un bot même en partie démarrée (besoin: "exclure les bots" pendant une partie).
        // Limitation: on évite de descendre sous 2 participants totaux pour ne pas laisser une table injouable.
        if (!this.isRoomOpen(room)) {
            const [humans, bots] = await Promise.all([
                this.countActiveHumans(room.id),
                this.countBots(room.id)
            ]);
            if (humans + bots - 1 < 2) {
                throw new _common.BadRequestException('Impossible de retirer ce bot : au moins deux participants sont requis');
            }
        }
        const bot = await this.bots.findOne({
            where: {
                id: botId,
                room: {
                    id: room.id
                }
            }
        });
        if (!bot) {
            throw new _common.NotFoundException('Bot introuvable');
        }
        await this.bots.delete(bot.id);
        return bot;
    }
    async getLastBotForRoom(roomId) {
        return this.bots.findOne({
            where: {
                room: {
                    id: roomId
                }
            },
            order: {
                id: 'DESC'
            }
        });
    }
    async statsForRoom(roomId) {
        const total = await this.countBots(roomId);
        return {
            roomId,
            total
        };
    }
    async listBotNames() {
        return this.botNames.find({
            order: {
                name: 'ASC'
            }
        });
    }
    async createBotName(name, enabled = true) {
        const sanitized = this.sanitizeName(name);
        if (!sanitized) {
            throw new _common.BadRequestException('Nom requis');
        }
        const exists = await this.botNames.findOne({
            where: {
                name: sanitized
            }
        });
        if (exists) {
            throw new _common.BadRequestException('Nom déjà utilisé');
        }
        const botName = this.botNames.create({
            name: sanitized,
            enabled
        });
        const saved = await this.botNames.save(botName);
        this.invalidateBotNamesCache();
        return saved;
    }
    async updateBotName(id, update) {
        const botName = await this.botNames.findOne({
            where: {
                id
            }
        });
        if (!botName) {
            throw new _common.NotFoundException('Bot introuvable');
        }
        if (update.name != null) {
            const sanitized = this.sanitizeName(update.name);
            if (!sanitized) {
                throw new _common.BadRequestException('Nom requis');
            }
            if (sanitized !== botName.name) {
                const exists = await this.botNames.findOne({
                    where: {
                        name: sanitized
                    }
                });
                if (exists) {
                    throw new _common.BadRequestException('Nom déjà utilisé');
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
        const botName = await this.botNames.findOne({
            where: {
                id
            }
        });
        if (!botName) {
            throw new _common.NotFoundException('Bot introuvable');
        }
        await this.botNames.delete(botName.id);
        this.invalidateBotNamesCache();
        return botName;
    }
    async pickName(existing) {
        const names = existing.map((b)=>b.name.toLowerCase());
        return this.findAvailableName(names);
    }
    sanitizeName(name) {
        const normalized = name.replace(/\s+/g, ' ').trim();
        return normalized.length > 100 ? normalized.slice(0, 100) : normalized;
    }
    async findAvailableName(existing) {
        const exclude = new Set(existing.map((n)=>n.toLowerCase()));
        const names = await this.getEnabledNames();
        for (const candidate of names){
            const sanitized = this.sanitizeName(candidate);
            if (!exclude.has(sanitized.toLowerCase())) {
                return sanitized;
            }
        }
        throw new _common.BadRequestException('Plus de noms de bots disponibles');
    }
    async getEnabledNames() {
        const cached = this.cachedEnabledNames;
        if (cached && (this.namesCacheTtlMs === 0 || Date.now() < cached.expiresAt)) {
            return this.shuffle(cached.values);
        }
        const rows = await this.botNames.find({
            where: {
                enabled: true
            },
            order: {
                name: 'ASC'
            }
        });
        if (rows.length === 0) {
            await this.seedDefaultNames();
            const seeded = await this.botNames.find({
                where: {
                    enabled: true
                },
                order: {
                    name: 'ASC'
                }
            });
            const values = seeded.map((r)=>r.name);
            this.cachedEnabledNames = {
                values,
                expiresAt: this.namesCacheTtlMs === 0 ? Number.MAX_SAFE_INTEGER : Date.now() + this.namesCacheTtlMs
            };
            return this.shuffle(values);
        }
        const values = rows.map((r)=>r.name);
        this.cachedEnabledNames = {
            values,
            expiresAt: this.namesCacheTtlMs === 0 ? Number.MAX_SAFE_INTEGER : Date.now() + this.namesCacheTtlMs
        };
        return this.shuffle(values);
    }
    invalidateBotNamesCache() {
        this.cachedEnabledNames = null;
    }
    async seedDefaultNames() {
        const defaults = [
            'Lila',
            'Cosmo',
            'Nova',
            'Pixel',
            'Orion',
            'Echo',
            'Bot'
        ];
        const count = await this.botNames.count();
        if (count > 0) return;
        const rows = defaults.map((name)=>this.botNames.create({
                name,
                enabled: true
            }));
        await this.botNames.save(rows);
    }
    shuffle(values) {
        const arr = [
            ...values
        ];
        for(let i = arr.length - 1; i > 0; i--){
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [
                arr[j],
                arr[i]
            ];
        }
        return arr;
    }
    async countBots(roomId) {
        return this.bots.count({
            where: {
                room: {
                    id: roomId
                }
            }
        });
    }
    async countBotsForRoom(roomId) {
        return this.countBots(roomId);
    }
    async removeAllBotsForRoom(roomId) {
        await this.bots.createQueryBuilder().delete().where('room_id = :roomId', {
            roomId
        }).execute();
    }
    async countActiveHumans(roomId) {
        return this.participants.count({
            where: {
                room: {
                    id: roomId
                },
                leftAt: (0, _typeorm1.IsNull)()
            }
        });
    }
    async requireRoomWithOwner(roomId) {
        const room = await this.rooms.findOne({
            where: {
                id: roomId
            },
            relations: [
                'owner'
            ]
        });
        if (!room) {
            throw new _common.NotFoundException('Table introuvable');
        }
        return room;
    }
    ensureOwner(room, userId) {
        if (!room.owner || room.owner.id !== userId) {
            throw new _common.UnauthorizedException('Seul le proprietaire peut gerer les bots');
        }
    }
    isRoomOpen(room) {
        const status = (room.status || '').toLowerCase();
        return _roomstatusconstants.OPEN_ROOM_STATUSES.includes(status);
    }
    constructor(bots, rooms, participants, botNames){
        this.bots = bots;
        this.rooms = rooms;
        this.participants = participants;
        this.botNames = botNames;
        this.cachedEnabledNames = null;
        const ttlCandidate = Number(process.env.BOT_NAMES_CACHE_TTL_MS ?? 30000);
        this.namesCacheTtlMs = Number.isFinite(ttlCandidate) && ttlCandidate >= 0 ? ttlCandidate : 30000;
    }
};
BotService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(0, (0, _typeorm.InjectRepository)(_roombotentity.RoomBot)),
    _ts_param(1, (0, _typeorm.InjectRepository)(_roomentity.Room)),
    _ts_param(2, (0, _typeorm.InjectRepository)(_roomparticipantentity.RoomParticipant)),
    _ts_param(3, (0, _typeorm.InjectRepository)(_botnameentity.BotName)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], BotService);
