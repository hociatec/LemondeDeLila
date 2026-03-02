"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GamePluginsModule", {
    enumerable: true,
    get: function() {
        return GamePluginsModule;
    }
});
const _common = require("@nestjs/common");
const _module = require("module");
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
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
const requireModule = (0, _module.createRequire)(__filename);
let GamePluginsModule = class GamePluginsModule {
    static forRoot() {
        const imports = this.discoverGameModules();
        if (imports.length === 0) {
            this.logger.warn('Aucun module de jeu détecté (dist/src).');
        } else {
            this.logger.log(`Modules de jeu détectés : ${imports.map((m)=>m.name).join(', ')}`);
        }
        return {
            module: GamePluginsModule,
            imports
        };
    }
    static discoverGameModules() {
        const root = this.resolveGamesRoot();
        if (!root) {
            this.logger.warn('Répertoire des jeux introuvable (dist/game/games ou src/game/games).');
            return [];
        }
        const moduleFiles = this.findModuleFiles(root);
        const modules = [];
        for (const file of moduleFiles){
            const loaded = this.loadModuleClasses(file);
            modules.push(...loaded);
        }
        return modules;
    }
    static resolveGamesRoot() {
        const envRoot = process.env.GAME_MODULES_ROOT;
        const candidates = [
            envRoot && _path.resolve(envRoot),
            _path.resolve(process.cwd(), 'dist', 'game', 'games'),
            _path.resolve(process.cwd(), 'dist', 'src', 'game', 'games'),
            _path.resolve(process.cwd(), 'src', 'game', 'games')
        ].filter(Boolean);
        for (const candidate of candidates){
            if (_fs.existsSync(candidate) && _fs.statSync(candidate).isDirectory()) {
                return candidate;
            }
        }
        return null;
    }
    static findModuleFiles(root) {
        const stack = [
            root
        ];
        const results = [];
        while(stack.length){
            const current = stack.pop();
            const entries = _fs.readdirSync(current, {
                withFileTypes: true
            });
            for (const entry of entries){
                const fullPath = _path.join(current, entry.name);
                if (entry.isDirectory()) {
                    stack.push(fullPath);
                    continue;
                }
                if (!entry.isFile()) continue;
                if (entry.name.endsWith('.d.ts')) continue;
                if (entry.name.endsWith('.module.js') || entry.name.endsWith('.module.ts')) {
                    results.push(fullPath);
                }
            }
        }
        return results;
    }
    static loadModuleClasses(filePath) {
        try {
            const moduleExports = requireModule(filePath);
            const candidates = Object.values(moduleExports).filter((value)=>typeof value === 'function' && value.name.endsWith('Module'));
            if (!candidates.length) {
                this.logger.warn(`Aucun module exporté trouvé dans ${filePath}`);
            }
            return candidates;
        } catch (error) {
            const errorMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Erreur inconnue';
            this.logger.warn(`Impossible de charger ${filePath} : ${errorMessage}`);
            return [];
        }
    }
};
GamePluginsModule.logger = new _common.Logger(GamePluginsModule.name);
GamePluginsModule = _ts_decorate([
    (0, _common.Module)({})
], GamePluginsModule);
