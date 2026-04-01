"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MnemoQuizStoreService", {
    enumerable: true,
    get: function() {
        return MnemoQuizStoreService;
    }
});
const _common = require("@nestjs/common");
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _os = /*#__PURE__*/ _interop_require_wildcard(require("os"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
const _crypto = require("crypto");
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
let MnemoQuizStoreService = class MnemoQuizStoreService {
    resolveStoragePath() {
        const envPath = String(process.env.MNEMO_QUIZ_PATH ?? '').trim();
        if (envPath) {
            return _path.resolve(envPath);
        }
        const legacyPath = _path.resolve(process.cwd(), 'data', 'arche-de-mnemosyne', 'quiz.json');
        const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase();
        if (nodeEnv !== 'production') {
            return legacyPath;
        }
        const persistentPath = _path.join(_os.homedir(), '.local', 'share', 'lemonde-de-lila', 'arche-de-mnemosyne', 'quiz.json');
        this.bootstrapPersistentStorage(legacyPath, persistentPath);
        return persistentPath;
    }
    bootstrapPersistentStorage(legacyPath, persistentPath) {
        if (_path.resolve(legacyPath) === _path.resolve(persistentPath)) {
            return;
        }
        try {
            if (!_fs.existsSync(legacyPath) || _fs.existsSync(persistentPath)) {
                return;
            }
            _fs.mkdirSync(_path.dirname(persistentPath), {
                recursive: true
            });
            _fs.copyFileSync(legacyPath, persistentPath);
        } catch  {
        // best-effort: if bootstrap fails, we continue with the persistent path;
        // admin can re-enter content without blocking startup.
        }
    }
    onModuleInit() {
        this.ensureLoaded();
    }
    getSnapshot() {
        this.ensureLoaded();
        return {
            categories: [
                ...this.data.categories
            ],
            questions: [
                ...this.data.questions
            ]
        };
    }
    listCategories() {
        return [
            ...this.getSnapshot().categories
        ].sort((a, b)=>a.name.localeCompare(b.name, 'fr'));
    }
    listQuestions(filter) {
        const snap = this.getSnapshot();
        let items = [
            ...snap.questions
        ];
        if (filter?.categoryId) {
            items = items.filter((q)=>q.categoryId === filter.categoryId);
        }
        if (filter?.status) {
            items = items.filter((q)=>q.status === filter.status);
        }
        return items.sort((a, b)=>(a.updatedAt ?? '').localeCompare(b.updatedAt));
    }
    createCategory(name) {
        const trimmed = String(name ?? '').trim();
        if (!trimmed) {
            throw new Error('Nom de catégorie requis');
        }
        const id = this.ensureUniqueId(this.slugify(trimmed));
        const category = {
            id,
            name: trimmed
        };
        this.data.categories.push(category);
        this.persist();
        return category;
    }
    renameCategory(categoryId, name) {
        const id = String(categoryId ?? '').trim();
        const trimmed = String(name ?? '').trim();
        if (!id) throw new Error('Catégorie requise');
        if (!trimmed) throw new Error('Nom requis');
        const category = this.data.categories.find((c)=>c.id === id);
        if (!category) {
            throw new Error('Catégorie introuvable');
        }
        category.name = trimmed;
        this.persist();
        return category;
    }
    deleteCategory(categoryId) {
        const id = String(categoryId ?? '').trim();
        if (!id) throw new Error('Catégorie requise');
        const before = this.data.categories.length;
        this.data.categories = this.data.categories.filter((c)=>c.id !== id);
        if (this.data.categories.length === before) {
            throw new Error('Catégorie introuvable');
        }
        // Best-effort: mettre les questions en corbeille si la catégorie disparaît.
        for (const q of this.data.questions){
            if (q.categoryId === id) {
                q.status = 'trash';
                q.updatedAt = new Date().toISOString();
            }
        }
        this.persist();
    }
    createQuestion(input) {
        const categoryId = String(input.categoryId ?? '').trim();
        if (!categoryId) throw new Error('Catégorie requise');
        if (!this.data.categories.some((c)=>c.id === categoryId)) {
            throw new Error('Catégorie introuvable');
        }
        const now = new Date().toISOString();
        const entity = {
            id: (0, _crypto.randomUUID)(),
            categoryId,
            question: String(input.question ?? '').trim(),
            correct: String(input.correct ?? '').trim(),
            wrong1: String(input.wrong1 ?? '').trim(),
            wrong2: String(input.wrong2 ?? '').trim(),
            wrong3: String(input.wrong3 ?? '').trim(),
            status: input.status ?? 'validated',
            createdAt: now,
            updatedAt: now
        };
        if (!entity.question) throw new Error('Question requise');
        if (!entity.correct) throw new Error('Bonne réponse requise');
        if (!entity.wrong1 || !entity.wrong2 || !entity.wrong3) {
            throw new Error('3 mauvaises réponses requises');
        }
        this.data.questions.push(entity);
        this.persist();
        return entity;
    }
    updateQuestion(questionId, patch) {
        const id = String(questionId ?? '').trim();
        if (!id) throw new Error('Question requise');
        const q = this.data.questions.find((x)=>x.id === id);
        if (!q) throw new Error('Question introuvable');
        if (patch.question !== undefined) q.question = String(patch.question).trim();
        if (patch.correct !== undefined) q.correct = String(patch.correct).trim();
        if (patch.wrong1 !== undefined) q.wrong1 = String(patch.wrong1).trim();
        if (patch.wrong2 !== undefined) q.wrong2 = String(patch.wrong2).trim();
        if (patch.wrong3 !== undefined) q.wrong3 = String(patch.wrong3).trim();
        if (patch.status !== undefined) q.status = patch.status;
        q.updatedAt = new Date().toISOString();
        if (!q.question) throw new Error('Question requise');
        if (!q.correct) throw new Error('Bonne réponse requise');
        if (!q.wrong1 || !q.wrong2 || !q.wrong3) {
            throw new Error('3 mauvaises réponses requises');
        }
        this.persist();
        return q;
    }
    deleteQuestion(questionId) {
        const id = String(questionId ?? '').trim();
        if (!id) throw new Error('Question requise');
        const before = this.data.questions.length;
        this.data.questions = this.data.questions.filter((x)=>x.id !== id);
        if (this.data.questions.length === before) {
            throw new Error('Question introuvable');
        }
        this.persist();
    }
    ensureLoaded() {
        try {
            const dir = _path.dirname(this.filePath);
            if (!_fs.existsSync(dir)) {
                _fs.mkdirSync(dir, {
                    recursive: true
                });
            }
            if (!_fs.existsSync(this.filePath)) {
                this.data = {
                    categories: [],
                    questions: []
                };
                this.persist();
                return;
            }
            const raw = _fs.readFileSync(this.filePath, 'utf-8');
            const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
            const categories = Array.isArray(parsed?.categories) ? parsed.categories : [];
            const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
            this.data = {
                categories,
                questions
            };
        } catch (err) {
            this.logger.warn(`Impossible de charger ${this.filePath}: ${err.message}`);
            this.data = {
                categories: [],
                questions: []
            };
        }
    }
    persist() {
        const dir = _path.dirname(this.filePath);
        if (!_fs.existsSync(dir)) {
            _fs.mkdirSync(dir, {
                recursive: true
            });
        }
        const tmp = `${this.filePath}.tmp`;
        _fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2) + '\n', 'utf-8');
        _fs.renameSync(tmp, this.filePath);
    }
    ensureUniqueId(base) {
        const clean = String(base ?? '').trim();
        if (!clean) throw new Error('Id invalide');
        let candidate = clean;
        let attempt = 1;
        while(this.data.categories.some((c)=>c.id === candidate)){
            candidate = `${clean}-${attempt++}`;
        }
        return candidate;
    }
    slugify(value) {
        const normalized = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    constructor(){
        this.logger = new _common.Logger(MnemoQuizStoreService.name);
        this.data = {
            categories: [],
            questions: []
        };
        this.filePath = this.resolveStoragePath();
    }
};
MnemoQuizStoreService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [])
], MnemoQuizStoreService);
