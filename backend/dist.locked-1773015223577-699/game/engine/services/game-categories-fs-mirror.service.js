"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameCategoriesFsMirrorService", {
    enumerable: true,
    get: function() {
        return GameCategoriesFsMirrorService;
    }
});
const _common = require("@nestjs/common");
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _os = /*#__PURE__*/ _interop_require_wildcard(require("os"));
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
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let GameCategoriesFsMirrorService = class GameCategoriesFsMirrorService {
    async syncAll(input) {
        try {
            await _fs.promises.mkdir(this.root, {
                recursive: true
            });
        } catch (err) {
            this.logger.warn(`Impossible de créer le répertoire miroir: ${err.message}`);
            return;
        }
        const categories = Array.isArray(input.categories) ? input.categories : [];
        const assignments = input.assignments ?? {};
        // 1) Upsert dossiers pour toutes les catégories
        for (const category of categories){
            await this.upsertCategory(category, categories, assignments);
        }
        // 2) Nettoyage best-effort : supprimer les dossiers orphelins (catégorie supprimée)
        // On supprime uniquement les dossiers qui contiennent un `.category.json` avec un id inconnu.
        const known = new Set(categories.map((c)=>c.id));
        await this.cleanupOrphans(known);
    }
    async deleteCategory(id) {
        const key = String(id ?? '').trim();
        if (!key) return;
        const found = await this.findFolderByCategoryId(key);
        if (!found) return;
        try {
            await _fs.promises.rm(found, {
                recursive: true,
                force: true
            });
        } catch (err) {
            this.logger.warn(`Impossible de supprimer le dossier miroir (id=${key}): ${err.message}`);
        }
    }
    async upsertCategory(category, categories, assignments) {
        const id = String(category?.id ?? '').trim();
        if (!id) return;
        const name = String(category?.name ?? '').trim() || id;
        const parentId = typeof category?.parentId === 'string' ? category.parentId.trim() : null;
        const desiredFolder = await this.resolveDesiredFolder({
            id,
            name,
            parentId
        }, categories);
        if (!desiredFolder) return;
        const existingFolder = await this.findFolderByCategoryId(id);
        const folder = existingFolder && existingFolder !== desiredFolder ? await this.safeMoveFolder(existingFolder, desiredFolder, id) : desiredFolder;
        try {
            await _fs.promises.mkdir(folder, {
                recursive: true
            });
        } catch (err) {
            this.logger.warn(`Impossible de créer le dossier miroir (id=${id}): ${err.message}`);
            return;
        }
        const now = new Date().toISOString();
        const entry = {
            id,
            name,
            parentId: parentId || null,
            updatedAt: now
        };
        const categoryJsonPath = _path.join(folder, '.category.json');
        const readmePath = _path.join(folder, 'README.md');
        const gamesJsonPath = _path.join(folder, 'games.json');
        const assignedGameTypes = Object.entries(assignments).filter(([, categoryId])=>categoryId === id).map(([gameType])=>gameType).sort((a, b)=>a.localeCompare(b, 'fr'));
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
            ''
        ].join('\n'));
        await this.safeWriteJson(gamesJsonPath, {
            categoryId: id,
            categoryName: name,
            games: assignedGameTypes
        });
    }
    async cleanupOrphans(knownIds) {
        try {
            const stack = [
                this.root
            ];
            while(stack.length){
                const current = stack.pop();
                const entries = await _fs.promises.readdir(current, {
                    withFileTypes: true
                });
                for (const entry of entries){
                    if (!entry.isDirectory()) continue;
                    const full = _path.join(current, entry.name);
                    const metaPath = _path.join(full, '.category.json');
                    try {
                        const raw = await _fs.promises.readFile(metaPath, 'utf-8');
                        const parsed = GameCategoriesFsMirrorService.parseJson(raw.replace(/^\uFEFF/, ''));
                        const id = GameCategoriesFsMirrorService.getTrimmedString(parsed, 'id');
                        if (id && !knownIds.has(id)) {
                            await _fs.promises.rm(full, {
                                recursive: true,
                                force: true
                            });
                            continue;
                        }
                    } catch  {
                    // Pas un dossier de miroir "racine" (ou pas de meta) : explorer quand même.
                    }
                    stack.push(full);
                }
            }
        } catch (err) {
            this.logger.debug(`Nettoyage orphelins miroir ignoré: ${err.message}`);
        }
    }
    async resolveDesiredFolder(category, categories) {
        const chain = [];
        const visited = new Set();
        let current = category;
        while(current){
            if (visited.has(current.id)) break;
            visited.add(current.id);
            chain.unshift({
                id: current.id,
                name: current.name
            });
            const pid = current.parentId ? current.parentId.trim() : '';
            if (!pid) break;
            const parent = categories.find((c)=>c.id === pid);
            if (!parent) break;
            current = {
                id: parent.id,
                name: String(parent.name ?? '').trim() || parent.id,
                parentId: parent.parentId ?? null
            };
        }
        if (chain.length === 0) return null;
        // IMPORTANT: les ids sont stables (recommandé). Le dossier doit donc être dérivé de l'id,
        // pas du nom affiché, pour éviter de renommer les chemins à chaque update de libellé.
        const segments = chain.map((c)=>this.safeFolderName(c.id));
        let out = _path.join(this.root, ...segments);
        // Collision: si un autre id a déjà pris ce chemin, on suffixe avec l'id.
        const existingMeta = await this.tryReadCategoryMeta(out);
        if (existingMeta && existingMeta.id && existingMeta.id !== category.id) {
            out = _path.join(this.root, ...segments.slice(0, -1), `${segments.at(-1)} (${category.id})`);
        }
        return out;
    }
    async findFolderByCategoryId(id) {
        const key = String(id ?? '').trim();
        if (!key) return null;
        try {
            const stack = [
                this.root
            ];
            while(stack.length){
                const current = stack.pop();
                if (!_fs.existsSync(current)) continue;
                const entries = await _fs.promises.readdir(current, {
                    withFileTypes: true
                });
                for (const entry of entries){
                    if (!entry.isDirectory()) continue;
                    const full = _path.join(current, entry.name);
                    const meta = await this.tryReadCategoryMeta(full);
                    if (meta?.id === key) {
                        return full;
                    }
                    stack.push(full);
                }
            }
            return null;
        } catch  {
            return null;
        }
    }
    async safeMoveFolder(from, to, categoryId) {
        if (!from || !to || from === to) return to;
        try {
            await _fs.promises.mkdir(_path.dirname(to), {
                recursive: true
            });
            if (!_fs.existsSync(from)) return to;
            if (!_fs.existsSync(to)) {
                await _fs.promises.rename(from, to);
                return to;
            }
            // Si le target existe, suffixer.
            let attempt = 1;
            let candidate = `${to} (${attempt})`;
            while(_fs.existsSync(candidate)){
                attempt += 1;
                candidate = `${to} (${attempt})`;
            }
            await _fs.promises.rename(from, candidate);
            return candidate;
        } catch (err) {
            this.logger.warn(`Impossible de renommer le dossier miroir (id=${categoryId}): ${err.message}`);
            return from;
        }
    }
    async tryReadCategoryMeta(folder) {
        try {
            const metaPath = _path.join(folder, '.category.json');
            const raw = await _fs.promises.readFile(metaPath, 'utf-8');
            const parsed = GameCategoriesFsMirrorService.parseJson(raw.replace(/^\uFEFF/, ''));
            const id = GameCategoriesFsMirrorService.getTrimmedString(parsed, 'id');
            if (!id) return null;
            return {
                id,
                name: GameCategoriesFsMirrorService.getTrimmedString(parsed, 'name') || id,
                parentId: GameCategoriesFsMirrorService.getTrimmedString(parsed, 'parentId') || null,
                updatedAt: GameCategoriesFsMirrorService.getTrimmedString(parsed, 'updatedAt')
            };
        } catch  {
            return null;
        }
    }
    safeFolderName(value) {
        const raw = String(value ?? '').trim();
        const noDiacritics = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const sanitized = noDiacritics.replace(/[\\/]+/g, ' ').replace(/[<>:"|?*]+/g, ' ');
        const cleaned = this.replaceControlCharacters(sanitized).replace(/\s+/g, ' ').trim();
        const noTrailing = cleaned.replace(/[. ]+$/g, '').trim();
        return noTrailing.length > 0 ? noTrailing.slice(0, 120) : 'Categorie';
    }
    replaceControlCharacters(value) {
        let out = '';
        for (const char of value){
            const code = char.charCodeAt(0);
            out += code > 31 ? char : ' ';
        }
        return out;
    }
    async safeWriteJson(filePath, data) {
        try {
            const tmp = `${filePath}.tmp`;
            await _fs.promises.writeFile(tmp, JSON.stringify(data ?? null, null, 2) + '\n', 'utf-8');
            await _fs.promises.rename(tmp, filePath);
        } catch (err) {
            this.logger.warn(`Ecriture JSON miroir échouée (${filePath}): ${err.message}`);
        }
    }
    async safeWriteText(filePath, text) {
        try {
            const tmp = `${filePath}.tmp`;
            await _fs.promises.writeFile(tmp, String(text ?? ''), 'utf-8');
            await _fs.promises.rename(tmp, filePath);
        } catch (err) {
            this.logger.warn(`Ecriture texte miroir échouée (${filePath}): ${err.message}`);
        }
    }
    static parseJson(value) {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        } catch  {
        // ignore
        }
        return {};
    }
    static getTrimmedString(record, key) {
        const value = record[key];
        return typeof value === 'string' ? value.trim() : '';
    }
    constructor(){
        this.logger = new _common.Logger(GameCategoriesFsMirrorService.name);
        const envRoot = (process.env.TAVERNE_CATEGORIES_ROOT || '').trim();
        if (envRoot) {
            this.root = _path.resolve(envRoot);
            return;
        }
        const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
        this.root = nodeEnv === 'production' ? _path.join(_os.homedir(), '.local', 'share', 'lemonde-de-lila', 'taverne-categories') : _path.resolve(process.cwd(), 'data', 'taverne-categories');
    }
};
GameCategoriesFsMirrorService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [])
], GameCategoriesFsMirrorService);
