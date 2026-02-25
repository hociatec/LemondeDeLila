"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameContentService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const game_registry_service_1 = require("./game-registry.service");
const game_catalog_overrides_service_1 = require("./game-catalog-overrides.service");
let GameContentService = class GameContentService {
    registry;
    overrides;
    rulesCache = new Map();
    devTtlMs = 3000;
    constructor(registry, overrides) {
        this.registry = registry;
        this.overrides = overrides;
    }
    async getRules(gameType) {
        const key = String(gameType ?? '').trim();
        const overrideRules = this.overrides.getGameOverride(key)?.rules ?? null;
        if (typeof overrideRules === 'string') {
            return overrideRules;
        }
        if (key) {
            const cached = this.rulesCache.get(key) ?? null;
            if (cached) {
                const ttl = process.env.NODE_ENV === 'development'
                    ? this.devTtlMs
                    : Number.POSITIVE_INFINITY;
                if (Date.now() - cached.loadedAt < ttl) {
                    return cached.value;
                }
            }
        }
        const defs = await this.registry.listGames();
        const game = defs.find((g) => g.id === gameType);
        if (game?.rulesPath && fs.existsSync(game.rulesPath)) {
            try {
                const value = await fs.promises.readFile(game.rulesPath, 'utf-8');
                if (key) {
                    this.rulesCache.set(key, { value, loadedAt: Date.now() });
                }
                return value;
            }
            catch {
            }
        }
        const fallback = `Règles non disponibles pour ${gameType}.`;
        if (key) {
            this.rulesCache.set(key, { value: fallback, loadedAt: Date.now() });
        }
        return fallback;
    }
};
exports.GameContentService = GameContentService;
exports.GameContentService = GameContentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_registry_service_1.GameRegistryService,
        game_catalog_overrides_service_1.GameCatalogOverridesService])
], GameContentService);
//# sourceMappingURL=game-content.service.js.map