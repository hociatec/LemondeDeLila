"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameCatalogOverridesService", {
    enumerable: true,
    get: function() {
        return GameCatalogOverridesService;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _gamecatalogoverrideentity = require("../entities/game-catalog-override.entity");
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
let GameCatalogOverridesService = class GameCatalogOverridesService {
    static normalizeStatus(value) {
        if (typeof value !== 'string') return undefined;
        const v = value.trim().toLowerCase();
        if (v === 'construction' || v === 'beta' || v === 'finished') {
            return v;
        }
        return undefined;
    }
    async onModuleInit() {
        await this.ensureLoaded();
    }
    getOverrides() {
        return this.cache ?? {
            games: {}
        };
    }
    getGameOverride(gameType) {
        if (!gameType) return null;
        const root = this.getOverrides();
        return root.games[gameType] ?? null;
    }
    apply(def) {
        const ov = this.getGameOverride(def.id);
        const base = {
            ...def,
            enabled: true
        };
        if (!ov) {
            return base;
        }
        const normalizedStatus = typeof ov.status === 'string' ? GameCatalogOverridesService.normalizeStatus(ov.status) : undefined;
        return {
            ...base,
            enabled: ov.enabled !== false,
            name: ov.name ?? def.name,
            description: ov.description ?? def.description,
            status: normalizedStatus ?? 'finished',
            minPlayers: typeof ov.minPlayers === 'number' ? ov.minPlayers : def.minPlayers,
            maxPlayers: typeof ov.maxPlayers === 'number' ? ov.maxPlayers : def.maxPlayers,
            chatEnabled: typeof ov.chatEnabled === 'boolean' ? ov.chatEnabled : typeof def.chatEnabled === 'boolean' ? def.chatEnabled : true,
            chatSoundsEnabled: typeof ov.chatSoundsEnabled === 'boolean' ? ov.chatSoundsEnabled : typeof def.chatSoundsEnabled === 'boolean' ? def.chatSoundsEnabled : true
        };
    }
    async setEnabled(gameType, enabled) {
        if (!gameType || !gameType.trim()) {
            throw new Error('gameType requis');
        }
        await this.ensureLoaded();
        const root = this.getOverrides();
        root.games[gameType] = {
            ...root.games[gameType] ?? {},
            enabled
        };
        await this.repo.save({
            gameType,
            enabled,
            minPlayers: root.games[gameType].minPlayers ?? null,
            maxPlayers: root.games[gameType].maxPlayers ?? null,
            name: root.games[gameType].name ?? null,
            description: root.games[gameType].description ?? null,
            rules: root.games[gameType].rules ?? null,
            status: root.games[gameType].status ?? null,
            chatEnabled: root.games[gameType].chatEnabled ?? null,
            chatSoundsEnabled: root.games[gameType].chatSoundsEnabled ?? null
        });
        this.cache = root;
    }
    async updateGameOverride(gameType, update) {
        if (!gameType || !gameType.trim()) {
            throw new Error('gameType requis');
        }
        await this.ensureLoaded();
        const root = this.getOverrides();
        const next = {
            ...root.games[gameType] ?? {},
            ...update
        };
        if (typeof next.name === 'string' && !next.name.trim()) delete next.name;
        if (typeof next.description === 'string' && !next.description.trim()) {
            delete next.description;
        }
        if (typeof next.rules === 'string' && !next.rules.trim()) {
            delete next.rules;
        }
        if (typeof next.status === 'string') {
            const normalized = GameCatalogOverridesService.normalizeStatus(next.status);
            if (!normalized) {
                delete next.status;
            } else {
                next.status = normalized;
            }
        }
        root.games[gameType] = next;
        await this.repo.save({
            gameType,
            enabled: typeof next.enabled === 'boolean' ? next.enabled : null,
            minPlayers: typeof next.minPlayers === 'number' ? next.minPlayers : null,
            maxPlayers: typeof next.maxPlayers === 'number' ? next.maxPlayers : null,
            name: typeof next.name === 'string' ? next.name : null,
            description: typeof next.description === 'string' ? next.description : null,
            rules: typeof next.rules === 'string' ? next.rules : null,
            status: next.status ?? null,
            chatEnabled: typeof next.chatEnabled === 'boolean' ? next.chatEnabled : null,
            chatSoundsEnabled: typeof next.chatSoundsEnabled === 'boolean' ? next.chatSoundsEnabled : null
        });
        this.cache = root;
        return next;
    }
    async clearGameOverride(gameType) {
        if (!gameType || !gameType.trim()) {
            throw new Error('gameType requis');
        }
        await this.ensureLoaded();
        const root = this.getOverrides();
        delete root.games[gameType];
        await this.repo.delete({
            gameType
        });
        this.cache = root;
    }
    async ensureLoaded() {
        if (this.cache) return;
        try {
            const rows = await this.repo.find();
            const games = {};
            for (const row of rows){
                games[row.gameType] = {
                    enabled: typeof row.enabled === 'boolean' ? row.enabled : undefined,
                    minPlayers: typeof row.minPlayers === 'number' ? row.minPlayers : undefined,
                    maxPlayers: typeof row.maxPlayers === 'number' ? row.maxPlayers : undefined,
                    name: row.name ?? undefined,
                    description: row.description ?? undefined,
                    rules: row.rules ?? undefined,
                    status: GameCatalogOverridesService.normalizeStatus(row.status),
                    chatEnabled: typeof row.chatEnabled === 'boolean' ? row.chatEnabled : undefined,
                    chatSoundsEnabled: typeof row.chatSoundsEnabled === 'boolean' ? row.chatSoundsEnabled : undefined
                };
            }
            this.cache = {
                games
            };
        } catch (error) {
            this.logger.warn(`Impossible de charger les overrides catalogue: ${error.message}`);
            this.cache = {
                games: {}
            };
        }
    }
    constructor(repo){
        this.repo = repo;
        this.logger = new _common.Logger(GameCatalogOverridesService.name);
        this.cache = null;
    }
};
GameCatalogOverridesService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(0, (0, _typeorm.InjectRepository)(_gamecatalogoverrideentity.GameCatalogOverrideEntity)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], GameCatalogOverridesService);
