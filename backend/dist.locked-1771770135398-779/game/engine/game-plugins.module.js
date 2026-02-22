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
var GamePluginsModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamePluginsModule = void 0;
const common_1 = require("@nestjs/common");
const module_1 = require("module");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const requireModule = (0, module_1.createRequire)(__filename);
let GamePluginsModule = class GamePluginsModule {
    static { GamePluginsModule_1 = this; }
    static logger = new common_1.Logger(GamePluginsModule_1.name);
    static forRoot() {
        const imports = this.discoverGameModules();
        if (imports.length === 0) {
            this.logger.warn('Aucun module de jeu détecté (dist/src).');
        }
        else {
            this.logger.log(`Modules de jeu détectés : ${imports.map((m) => m.name).join(', ')}`);
        }
        return {
            module: GamePluginsModule_1,
            imports,
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
        for (const file of moduleFiles) {
            const loaded = this.loadModuleClasses(file);
            modules.push(...loaded);
        }
        return modules;
    }
    static resolveGamesRoot() {
        const envRoot = process.env.GAME_MODULES_ROOT;
        const candidates = [
            envRoot && path.resolve(envRoot),
            path.resolve(process.cwd(), 'dist', 'game', 'games'),
            path.resolve(process.cwd(), 'dist', 'src', 'game', 'games'),
            path.resolve(process.cwd(), 'src', 'game', 'games'),
        ].filter(Boolean);
        for (const candidate of candidates) {
            if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
                return candidate;
            }
        }
        return null;
    }
    static findModuleFiles(root) {
        const stack = [root];
        const results = [];
        while (stack.length) {
            const current = stack.pop();
            const entries = fs.readdirSync(current, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    stack.push(fullPath);
                    continue;
                }
                if (!entry.isFile())
                    continue;
                if (entry.name.endsWith('.d.ts'))
                    continue;
                if (entry.name.endsWith('.module.js') ||
                    entry.name.endsWith('.module.ts')) {
                    results.push(fullPath);
                }
            }
        }
        return results;
    }
    static loadModuleClasses(filePath) {
        try {
            const moduleExports = requireModule(filePath);
            const candidates = Object.values(moduleExports).filter((value) => typeof value === 'function' && value.name.endsWith('Module'));
            if (!candidates.length) {
                this.logger.warn(`Aucun module exporté trouvé dans ${filePath}`);
            }
            return candidates;
        }
        catch (error) {
            const errorMessage = typeof error === 'string'
                ? error
                : error instanceof Error
                    ? error.message
                    : 'Erreur inconnue';
            this.logger.warn(`Impossible de charger ${filePath} : ${errorMessage}`);
            return [];
        }
    }
};
exports.GamePluginsModule = GamePluginsModule;
exports.GamePluginsModule = GamePluginsModule = GamePluginsModule_1 = __decorate([
    (0, common_1.Module)({})
], GamePluginsModule);
//# sourceMappingURL=game-plugins.module.js.map