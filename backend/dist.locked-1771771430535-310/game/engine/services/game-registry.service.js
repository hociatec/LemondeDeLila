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
var GameRegistryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRegistryService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const game_catalog_overrides_service_1 = require("./game-catalog-overrides.service");
const game_categories_service_1 = require("./game-categories.service");
let GameRegistryService = GameRegistryService_1 = class GameRegistryService {
    overrides;
    categories;
    handlers = new Map();
    gamesRoot;
    logger = new common_1.Logger(GameRegistryService_1.name);
    cachedDefinitions = null;
    cachedAtMs = 0;
    devTtlMs = 30000;
    constructor(overrides, categories) {
        this.overrides = overrides;
        this.categories = categories;
        const envRoot = process.env.GAME_CATALOG_PATH;
        const cwd = process.cwd();
        const candidates = [
            envRoot ? path.resolve(envRoot) : null,
            path.resolve(cwd, 'dist', 'game', 'games'),
            path.resolve(cwd, 'src', 'game', 'games'),
        ].filter((p) => Boolean(p));
        this.gamesRoot =
            candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isDirectory()) ?? path.resolve(cwd, 'src', 'game', 'games');
    }
    invalidateCache() {
        this.cachedDefinitions = null;
        this.cachedAtMs = 0;
    }
    getHandler(gameType) {
        return this.handlers.get(gameType);
    }
    register(handler) {
        if (!handler?.gameType) {
            this.logger.warn('Tentative de registre d’un handler sans gameType, ignoré.');
            return;
        }
        const existing = this.handlers.get(handler.gameType);
        if (existing && existing !== handler) {
            this.logger.log(`Remplacement du handler existant pour ${handler.gameType}`);
        }
        this.handlers.set(handler.gameType, handler);
        this.logger.log(`Handler enregistré : ${handler.gameType}`);
    }
    async listGames(options) {
        const useCache = this.cachedDefinitions && this.isCacheFresh();
        if (useCache && this.cachedDefinitions) {
            return this.buildGameListFromDefinitions(this.cachedDefinitions, options);
        }
        const definitions = await this.loadDefinitionsFromFs();
        const merged = definitions.map((def) => this.enrichWithHandler(def));
        this.cachedDefinitions = merged;
        this.cachedAtMs = Date.now();
        return this.buildGameListFromDefinitions(merged, options);
    }
    buildGameListFromDefinitions(defs, options) {
        const withOverrides = defs.map((d) => this.overrides.apply(d));
        const filtered = options?.includeDisabledOverrides
            ? withOverrides
            : withOverrides.filter((d) => d.enabled !== false);
        return filtered.map((entry) => {
            const { enabled, status, ...rest } = entry;
            void enabled;
            void status;
            return rest;
        });
    }
    isCacheFresh() {
        const ttl = process.env.NODE_ENV === 'development'
            ? this.devTtlMs
            : Number.POSITIVE_INFINITY;
        return Date.now() - this.cachedAtMs < ttl;
    }
    enrichWithHandler(def) {
        const handler = this.getHandler(def.id);
        if (!handler) {
            return this.categories.applyToDefinition(def);
        }
        const enriched = {
            id: def.id,
            name: def.name || handler.displayName,
            category: def.category || handler.category,
            subcategory: def.subcategory || handler.subcategory,
            description: def.description || handler.description,
            minPlayers: def.minPlayers ?? handler.minPlayers,
            maxPlayers: def.maxPlayers ?? handler.maxPlayers,
            manifestPath: def.manifestPath,
            rulesPath: def.rulesPath,
        };
        return this.categories.applyToDefinition(enriched);
    }
    async loadDefinitionsFromFs() {
        const root = path.resolve(this.gamesRoot);
        if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
            this.logger.warn(`Répertoire de jeux introuvable : ${root}`);
            return [];
        }
        const manifests = await this.findManifestPaths(root);
        const results = [];
        for (const manifestPath of manifests) {
            const def = await this.readDefinition(manifestPath, root);
            if (def) {
                results.push(def);
            }
        }
        return results;
    }
    async findManifestPaths(root) {
        const stack = [root];
        const manifests = [];
        while (stack.length > 0) {
            const current = stack.pop();
            const entries = await fs.promises.readdir(current, {
                withFileTypes: true,
            });
            for (const entry of entries) {
                const fullPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    stack.push(fullPath);
                }
                else if (entry.isFile() && entry.name === 'manifest.json') {
                    manifests.push(fullPath);
                }
            }
        }
        return manifests;
    }
    async readDefinition(manifestPath, root) {
        try {
            const raw = await fs.promises.readFile(manifestPath, 'utf-8');
            const data = JSON.parse(raw.replace(/^\uFEFF/, ''));
            if (data.enabled === false) {
                this.logger.warn(`Jeu désactivé ignoré (manifest): ${manifestPath} (${data.code ?? data.id ?? 'unknown'})`);
                return null;
            }
            const id = data.code ?? data.id ?? '';
            if (!id) {
                this.logger.warn(`Manifest sans code ignoré: ${manifestPath}`);
                return null;
            }
            const relPath = path.relative(root, path.dirname(manifestPath));
            const segments = relPath.split(path.sep).filter(Boolean);
            const hasHandler = this.handlers.has(id);
            const rawCategory = typeof data.category === 'string' ? data.category : '';
            const rawSubcategory = typeof data.subcategory === 'string' ? data.subcategory : '';
            const category = this.formatName(rawCategory || (hasHandler ? '' : (segments[0] ?? 'Catalogue')));
            const subcategory = this.formatName(rawSubcategory || '');
            return {
                id,
                name: data.name ?? this.formatName(segments[segments.length - 1] ?? id),
                category,
                subcategory: subcategory || undefined,
                description: data.summary ?? data.description ?? '',
                minPlayers: data.minPlayers,
                maxPlayers: data.maxPlayers,
                chatEnabled: typeof data.chatEnabled === 'boolean' ? data.chatEnabled : undefined,
                chatSoundsEnabled: typeof data.chatSoundsEnabled === 'boolean'
                    ? data.chatSoundsEnabled
                    : undefined,
                manifestPath,
                rulesPath: path.join(path.dirname(manifestPath), 'rules.md'),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error ?? '');
            this.logger.warn(`Manifest invalide ${manifestPath}: ${errorMessage}`);
            return null;
        }
    }
    formatName(value) {
        if (!value)
            return '';
        const spaced = value
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ');
        return spaced
            .split(' ')
            .filter(Boolean)
            .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
            .join(' ');
    }
};
exports.GameRegistryService = GameRegistryService;
exports.GameRegistryService = GameRegistryService = GameRegistryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_catalog_overrides_service_1.GameCatalogOverridesService,
        game_categories_service_1.GameCategoriesService])
], GameRegistryService);
//# sourceMappingURL=game-registry.service.js.map