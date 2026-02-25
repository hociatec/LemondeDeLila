"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameRegistryService", {
    enumerable: true,
    get: function() {
        return GameRegistryService;
    }
});
const _common = require("@nestjs/common");
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
const _gamecatalogoverridesservice = require("./game-catalog-overrides.service");
const _gamecategoriesservice = require("./game-categories.service");
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
let GameRegistryService = class GameRegistryService {
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
        const merged = definitions.map((def)=>this.enrichWithHandler(def));
        this.cachedDefinitions = merged;
        this.cachedAtMs = Date.now();
        return this.buildGameListFromDefinitions(merged, options);
    }
    buildGameListFromDefinitions(defs, options) {
        const withOverrides = defs.map((d)=>this.overrides.apply(d));
        const filtered = options?.includeDisabledOverrides ? withOverrides : withOverrides.filter((d)=>d.enabled !== false);
        return filtered.map((entry)=>{
            const { enabled, status, ...rest } = entry;
            void enabled;
            void status;
            return rest;
        });
    }
    isCacheFresh() {
        const ttl = process.env.NODE_ENV === 'development' ? this.devTtlMs : Number.POSITIVE_INFINITY;
        return Date.now() - this.cachedAtMs < ttl;
    }
    enrichWithHandler(def) {
        const handler = this.getHandler(def.id);
        if (!handler) {
            // Même sans handler, on doit appliquer les overrides de catégories (admin)
            // pour que le catalogue affiche les libellés configurés.
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
            rulesPath: def.rulesPath
        };
        return this.categories.applyToDefinition(enriched);
    }
    async loadDefinitionsFromFs() {
        const root = _path.resolve(this.gamesRoot);
        if (!_fs.existsSync(root) || !_fs.statSync(root).isDirectory()) {
            this.logger.warn(`Répertoire de jeux introuvable : ${root}`);
            return [];
        }
        const manifests = await this.findManifestPaths(root);
        const results = [];
        for (const manifestPath of manifests){
            const def = await this.readDefinition(manifestPath, root);
            if (def) {
                results.push(def);
            }
        }
        return results;
    }
    async findManifestPaths(root) {
        const stack = [
            root
        ];
        const manifests = [];
        while(stack.length > 0){
            const current = stack.pop();
            const entries = await _fs.promises.readdir(current, {
                withFileTypes: true
            });
            for (const entry of entries){
                const fullPath = _path.join(current, entry.name);
                if (entry.isDirectory()) {
                    stack.push(fullPath);
                } else if (entry.isFile() && entry.name === 'manifest.json') {
                    manifests.push(fullPath);
                }
            }
        }
        return manifests;
    }
    async readDefinition(manifestPath, root) {
        try {
            const raw = await _fs.promises.readFile(manifestPath, 'utf-8');
            // Certains fichiers JSON peuvent contenir un BOM UTF-8 (U+FEFF) au début.
            // JSON.parse ne le tolère pas -> on le supprime.
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
            const relPath = _path.relative(root, _path.dirname(manifestPath));
            const segments = relPath.split(_path.sep).filter(Boolean);
            const hasHandler = this.handlers.has(id);
            const rawCategory = typeof data.category === 'string' ? data.category : '';
            const rawSubcategory = typeof data.subcategory === 'string' ? data.subcategory : '';
            // IMPORTANT:
            // - On ne déduit pas la sous-catégorie depuis l'arborescence FS (ça créait une sous-catégorie par jeu côté client).
            // - Si un handler est enregistré, on laisse category/subcategory vides pour que enrichWithHandler applique les valeurs
            //   de l'adaptateur (ex: JeuxDePlateaux / LesQuatreVents), sauf si manifest précise explicitement ces champs.
            const category = this.formatName(rawCategory || (hasHandler ? '' : segments[0] ?? 'Catalogue'));
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
                chatSoundsEnabled: typeof data.chatSoundsEnabled === 'boolean' ? data.chatSoundsEnabled : undefined,
                manifestPath,
                rulesPath: _path.join(_path.dirname(manifestPath), 'rules.md')
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error ?? '');
            this.logger.warn(`Manifest invalide ${manifestPath}: ${errorMessage}`);
            return null;
        }
    }
    formatName(value) {
        if (!value) return '';
        const spaced = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
        return spaced.split(' ').filter(Boolean).map((segment)=>segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()).join(' ');
    }
    constructor(overrides, categories){
        this.overrides = overrides;
        this.categories = categories;
        this.handlers = new Map();
        this.logger = new _common.Logger(GameRegistryService.name);
        this.cachedDefinitions = null;
        this.cachedAtMs = 0;
        this.devTtlMs = 30000;
        const envRoot = process.env.GAME_CATALOG_PATH;
        const cwd = process.cwd();
        const candidates = [
            envRoot ? _path.resolve(envRoot) : null,
            _path.resolve(cwd, 'dist', 'game', 'games'),
            _path.resolve(cwd, 'src', 'game', 'games')
        ].filter((p)=>Boolean(p));
        this.gamesRoot = candidates.find((p)=>_fs.existsSync(p) && _fs.statSync(p).isDirectory()) ?? _path.resolve(cwd, 'src', 'game', 'games');
    }
};
GameRegistryService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecatalogoverridesservice.GameCatalogOverridesService === "undefined" ? Object : _gamecatalogoverridesservice.GameCatalogOverridesService,
        typeof _gamecategoriesservice.GameCategoriesService === "undefined" ? Object : _gamecategoriesservice.GameCategoriesService
    ])
], GameRegistryService);
