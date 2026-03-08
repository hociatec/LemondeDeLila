"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameContentService", {
    enumerable: true,
    get: function() {
        return GameContentService;
    }
});
const _common = require("@nestjs/common");
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _gameregistryservice = require("./game-registry.service");
const _gamecatalogoverridesservice = require("./game-catalog-overrides.service");
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let GameContentService = class GameContentService {
    async getRules(gameType) {
        const key = String(gameType ?? '').trim();
        const overrideRules = this.overrides.getGameOverride(key)?.rules ?? null;
        if (typeof overrideRules === 'string') {
            return overrideRules;
        }
        if (key) {
            const cached = this.rulesCache.get(key) ?? null;
            if (cached) {
                const ttl = process.env.NODE_ENV === 'development' ? this.devTtlMs : Number.POSITIVE_INFINITY;
                if (Date.now() - cached.loadedAt < ttl) {
                    return cached.value;
                }
            }
        }
        const defs = await this.registry.listGames();
        const game = defs.find((g)=>g.id === gameType);
        if (game?.rulesPath && _fs.existsSync(game.rulesPath)) {
            try {
                const value = await _fs.promises.readFile(game.rulesPath, 'utf-8');
                if (key) {
                    this.rulesCache.set(key, {
                        value,
                        loadedAt: Date.now()
                    });
                }
                return value;
            } catch  {
            /* ignore */ }
        }
        const fallback = `Règles non disponibles pour ${gameType}.`;
        if (key) {
            this.rulesCache.set(key, {
                value: fallback,
                loadedAt: Date.now()
            });
        }
        return fallback;
    }
    constructor(registry, overrides){
        this.registry = registry;
        this.overrides = overrides;
        this.rulesCache = new Map();
        this.devTtlMs = 3000;
    }
};
GameContentService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gameregistryservice.GameRegistryService === "undefined" ? Object : _gameregistryservice.GameRegistryService,
        typeof _gamecatalogoverridesservice.GameCatalogOverridesService === "undefined" ? Object : _gamecatalogoverridesservice.GameCatalogOverridesService
    ])
], GameContentService);
