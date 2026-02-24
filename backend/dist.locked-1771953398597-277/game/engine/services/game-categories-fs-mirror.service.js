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
var GameCategoriesFsMirrorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameCategoriesFsMirrorService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
let GameCategoriesFsMirrorService = GameCategoriesFsMirrorService_1 = class GameCategoriesFsMirrorService {
    logger = new common_1.Logger(GameCategoriesFsMirrorService_1.name);
    root;
    constructor() {
        const envRoot = (process.env.TAVERNE_CATEGORIES_ROOT || '').trim();
        if (envRoot) {
            this.root = path.resolve(envRoot);
            return;
        }
        const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
        this.root =
            nodeEnv === 'production'
                ? path.join(os.homedir(), '.local', 'share', 'lemonde-de-lila', 'taverne-categories')
                : path.resolve(process.cwd(), 'data', 'taverne-categories');
    }
    async syncAll(input) {
        try {
            await fs.promises.mkdir(this.root, { recursive: true });
        }
        catch (err) {
            this.logger.warn(`Impossible de créer le répertoire miroir: ${err.message}`);
            return;
        }
        const categories = Array.isArray(input.categories) ? input.categories : [];
        const assignments = input.assignments ?? {};
        for (const category of categories) {
            await this.upsertCategory(category, categories, assignments);
        }
        const known = new Set(categories.map((c) => c.id));
        await this.cleanupOrphans(known);
    }
    async deleteCategory(id) {
        const key = String(id ?? '').trim();
        if (!key)
            return;
        const found = await this.findFolderByCategoryId(key);
        if (!found)
            return;
        try {
            await fs.promises.rm(found, { recursive: true, force: true });
        }
        catch (err) {
            this.logger.warn(`Impossible de supprimer le dossier miroir (id=${key}): ${err.message}`);
        }
    }
    async upsertCategory(category, categories, assignments) {
        const id = String(category?.id ?? '').trim();
        if (!id)
            return;
        const name = String(category?.name ?? '').trim() || id;
        const parentId = typeof category?.parentId === 'string' ? category.parentId.trim() : null;
        const desiredFolder = await this.resolveDesiredFolder({ id, name, parentId }, categories);
        if (!desiredFolder)
            return;
        const existingFolder = await this.findFolderByCategoryId(id);
        const folder = existingFolder && existingFolder !== desiredFolder
            ? await this.safeMoveFolder(existingFolder, desiredFolder, id)
            : desiredFolder;
        try {
            await fs.promises.mkdir(folder, { recursive: true });
        }
        catch (err) {
            this.logger.warn(`Impossible de créer le dossier miroir (id=${id}): ${err.message}`);
            return;
        }
        const now = new Date().toISOString();
        const entry = {
            id,
            name,
            parentId: parentId || null,
            updatedAt: now,
        };
        const categoryJsonPath = path.join(folder, '.category.json');
        const readmePath = path.join(folder, 'README.md');
        const gamesJsonPath = path.join(folder, 'games.json');
        const assignedGameTypes = Object.entries(assignments)
            .filter(([, categoryId]) => categoryId === id)
            .map(([gameType]) => gameType)
            .sort((a, b) => a.localeCompare(b, 'fr'));
        await this.safeWriteJson(categoryJsonPath, entry);
        await this.safeWriteText(readmePath, [
            `# ${name}`,
            '',
            `- id: \`${id}\``,
            parentId ? `- parentId: \`${parentId}\`` : `- parentId: \`null\``,
            `- syncedAt: \`${now}\``,
            '',
            'Ce dossier est un miroir automatique de la taverne.',
            'Ne pas y mettre de code: il peut être renommé/supprimé automatiquement.',
            '',
        ].join('\n'));
        await this.safeWriteJson(gamesJsonPath, {
            categoryId: id,
            categoryName: name,
            games: assignedGameTypes,
        });
    }
    async cleanupOrphans(knownIds) {
        try {
            const stack = [this.root];
            while (stack.length) {
                const current = stack.pop();
                const entries = await fs.promises.readdir(current, {
                    withFileTypes: true,
                });
                for (const entry of entries) {
                    if (!entry.isDirectory())
                        continue;
                    const full = path.join(current, entry.name);
                    const metaPath = path.join(full, '.category.json');
                    try {
                        const raw = await fs.promises.readFile(metaPath, 'utf-8');
                        const parsed = GameCategoriesFsMirrorService_1.parseJson(raw.replace(/^\uFEFF/, ''));
                        const id = GameCategoriesFsMirrorService_1.getTrimmedString(parsed, 'id');
                        if (id && !knownIds.has(id)) {
                            await fs.promises.rm(full, { recursive: true, force: true });
                            continue;
                        }
                    }
                    catch {
                    }
                    stack.push(full);
                }
            }
        }
        catch (err) {
            this.logger.debug(`Nettoyage orphelins miroir ignoré: ${err.message}`);
        }
    }
    async resolveDesiredFolder(category, categories) {
        const chain = [];
        const visited = new Set();
        let current = category;
        while (current) {
            if (visited.has(current.id))
                break;
            visited.add(current.id);
            chain.unshift({ id: current.id, name: current.name });
            const pid = current.parentId ? current.parentId.trim() : '';
            if (!pid)
                break;
            const parent = categories.find((c) => c.id === pid);
            if (!parent)
                break;
            current = {
                id: parent.id,
                name: String(parent.name ?? '').trim() || parent.id,
                parentId: parent.parentId ?? null,
            };
        }
        if (chain.length === 0)
            return null;
        const segments = chain.map((c) => this.safeFolderName(c.id));
        let out = path.join(this.root, ...segments);
        const existingMeta = await this.tryReadCategoryMeta(out);
        if (existingMeta && existingMeta.id && existingMeta.id !== category.id) {
            out = path.join(this.root, ...segments.slice(0, -1), `${segments.at(-1)} (${category.id})`);
        }
        return out;
    }
    async findFolderByCategoryId(id) {
        const key = String(id ?? '').trim();
        if (!key)
            return null;
        try {
            const stack = [this.root];
            while (stack.length) {
                const current = stack.pop();
                if (!fs.existsSync(current))
                    continue;
                const entries = await fs.promises.readdir(current, {
                    withFileTypes: true,
                });
                for (const entry of entries) {
                    if (!entry.isDirectory())
                        continue;
                    const full = path.join(current, entry.name);
                    const meta = await this.tryReadCategoryMeta(full);
                    if (meta?.id === key) {
                        return full;
                    }
                    stack.push(full);
                }
            }
            return null;
        }
        catch {
            return null;
        }
    }
    async safeMoveFolder(from, to, categoryId) {
        if (!from || !to || from === to)
            return to;
        try {
            await fs.promises.mkdir(path.dirname(to), { recursive: true });
            if (!fs.existsSync(from))
                return to;
            if (!fs.existsSync(to)) {
                await fs.promises.rename(from, to);
                return to;
            }
            let attempt = 1;
            let candidate = `${to} (${attempt})`;
            while (fs.existsSync(candidate)) {
                attempt += 1;
                candidate = `${to} (${attempt})`;
            }
            await fs.promises.rename(from, candidate);
            return candidate;
        }
        catch (err) {
            this.logger.warn(`Impossible de renommer le dossier miroir (id=${categoryId}): ${err.message}`);
            return from;
        }
    }
    async tryReadCategoryMeta(folder) {
        try {
            const metaPath = path.join(folder, '.category.json');
            const raw = await fs.promises.readFile(metaPath, 'utf-8');
            const parsed = GameCategoriesFsMirrorService_1.parseJson(raw.replace(/^\uFEFF/, ''));
            const id = GameCategoriesFsMirrorService_1.getTrimmedString(parsed, 'id');
            if (!id)
                return null;
            return {
                id,
                name: GameCategoriesFsMirrorService_1.getTrimmedString(parsed, 'name') || id,
                parentId: GameCategoriesFsMirrorService_1.getTrimmedString(parsed, 'parentId') ||
                    null,
                updatedAt: GameCategoriesFsMirrorService_1.getTrimmedString(parsed, 'updatedAt'),
            };
        }
        catch {
            return null;
        }
    }
    safeFolderName(value) {
        const raw = String(value ?? '').trim();
        const noDiacritics = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const sanitized = noDiacritics
            .replace(/[\\/]+/g, ' ')
            .replace(/[<>:"|?*]+/g, ' ');
        const cleaned = this.replaceControlCharacters(sanitized)
            .replace(/\s+/g, ' ')
            .trim();
        const noTrailing = cleaned.replace(/[. ]+$/g, '').trim();
        return noTrailing.length > 0 ? noTrailing.slice(0, 120) : 'Categorie';
    }
    replaceControlCharacters(value) {
        let out = '';
        for (const char of value) {
            const code = char.charCodeAt(0);
            out += code > 31 ? char : ' ';
        }
        return out;
    }
    async safeWriteJson(filePath, data) {
        try {
            const tmp = `${filePath}.tmp`;
            await fs.promises.writeFile(tmp, JSON.stringify(data ?? null, null, 2) + '\n', 'utf-8');
            await fs.promises.rename(tmp, filePath);
        }
        catch (err) {
            this.logger.warn(`Ecriture JSON miroir échouée (${filePath}): ${err.message}`);
        }
    }
    async safeWriteText(filePath, text) {
        try {
            const tmp = `${filePath}.tmp`;
            await fs.promises.writeFile(tmp, String(text ?? ''), 'utf-8');
            await fs.promises.rename(tmp, filePath);
        }
        catch (err) {
            this.logger.warn(`Ecriture texte miroir échouée (${filePath}): ${err.message}`);
        }
    }
    static parseJson(value) {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        }
        catch {
        }
        return {};
    }
    static getTrimmedString(record, key) {
        const value = record[key];
        return typeof value === 'string' ? value.trim() : '';
    }
};
exports.GameCategoriesFsMirrorService = GameCategoriesFsMirrorService;
exports.GameCategoriesFsMirrorService = GameCategoriesFsMirrorService = GameCategoriesFsMirrorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], GameCategoriesFsMirrorService);
//# sourceMappingURL=game-categories-fs-mirror.service.js.map