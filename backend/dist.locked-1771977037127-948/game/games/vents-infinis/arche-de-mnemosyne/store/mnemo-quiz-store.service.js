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
var MnemoQuizStoreService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MnemoQuizStoreService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
let MnemoQuizStoreService = MnemoQuizStoreService_1 = class MnemoQuizStoreService {
    logger = new common_1.Logger(MnemoQuizStoreService_1.name);
    filePath;
    data = { categories: [], questions: [] };
    constructor() {
        const envPath = process.env.MNEMO_QUIZ_PATH;
        this.filePath = envPath
            ? path.resolve(envPath)
            : path.resolve(process.cwd(), 'data', 'arche-de-mnemosyne', 'quiz.json');
    }
    onModuleInit() {
        this.ensureLoaded();
    }
    getSnapshot() {
        this.ensureLoaded();
        return {
            categories: [...this.data.categories],
            questions: [...this.data.questions],
        };
    }
    listCategories() {
        return [...this.getSnapshot().categories].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    listQuestions(filter) {
        const snap = this.getSnapshot();
        let items = [...snap.questions];
        if (filter?.categoryId) {
            items = items.filter((q) => q.categoryId === filter.categoryId);
        }
        if (filter?.status) {
            items = items.filter((q) => q.status === filter.status);
        }
        return items.sort((a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt));
    }
    createCategory(name) {
        const trimmed = String(name ?? '').trim();
        if (!trimmed) {
            throw new Error('Nom de catégorie requis');
        }
        const id = this.ensureUniqueId(this.slugify(trimmed));
        const category = { id, name: trimmed };
        this.data.categories.push(category);
        this.persist();
        return category;
    }
    renameCategory(categoryId, name) {
        const id = String(categoryId ?? '').trim();
        const trimmed = String(name ?? '').trim();
        if (!id)
            throw new Error('Catégorie requise');
        if (!trimmed)
            throw new Error('Nom requis');
        const category = this.data.categories.find((c) => c.id === id);
        if (!category) {
            throw new Error('Catégorie introuvable');
        }
        category.name = trimmed;
        this.persist();
        return category;
    }
    deleteCategory(categoryId) {
        const id = String(categoryId ?? '').trim();
        if (!id)
            throw new Error('Catégorie requise');
        const before = this.data.categories.length;
        this.data.categories = this.data.categories.filter((c) => c.id !== id);
        if (this.data.categories.length === before) {
            throw new Error('Catégorie introuvable');
        }
        for (const q of this.data.questions) {
            if (q.categoryId === id) {
                q.status = 'trash';
                q.updatedAt = new Date().toISOString();
            }
        }
        this.persist();
    }
    createQuestion(input) {
        const categoryId = String(input.categoryId ?? '').trim();
        if (!categoryId)
            throw new Error('Catégorie requise');
        if (!this.data.categories.some((c) => c.id === categoryId)) {
            throw new Error('Catégorie introuvable');
        }
        const now = new Date().toISOString();
        const entity = {
            id: (0, crypto_1.randomUUID)(),
            categoryId,
            question: String(input.question ?? '').trim(),
            correct: String(input.correct ?? '').trim(),
            wrong1: String(input.wrong1 ?? '').trim(),
            wrong2: String(input.wrong2 ?? '').trim(),
            wrong3: String(input.wrong3 ?? '').trim(),
            status: input.status ?? 'validated',
            createdAt: now,
            updatedAt: now,
        };
        if (!entity.question)
            throw new Error('Question requise');
        if (!entity.correct)
            throw new Error('Bonne réponse requise');
        if (!entity.wrong1 || !entity.wrong2 || !entity.wrong3) {
            throw new Error('3 mauvaises réponses requises');
        }
        this.data.questions.push(entity);
        this.persist();
        return entity;
    }
    updateQuestion(questionId, patch) {
        const id = String(questionId ?? '').trim();
        if (!id)
            throw new Error('Question requise');
        const q = this.data.questions.find((x) => x.id === id);
        if (!q)
            throw new Error('Question introuvable');
        if (patch.question !== undefined)
            q.question = String(patch.question).trim();
        if (patch.correct !== undefined)
            q.correct = String(patch.correct).trim();
        if (patch.wrong1 !== undefined)
            q.wrong1 = String(patch.wrong1).trim();
        if (patch.wrong2 !== undefined)
            q.wrong2 = String(patch.wrong2).trim();
        if (patch.wrong3 !== undefined)
            q.wrong3 = String(patch.wrong3).trim();
        if (patch.status !== undefined)
            q.status = patch.status;
        q.updatedAt = new Date().toISOString();
        if (!q.question)
            throw new Error('Question requise');
        if (!q.correct)
            throw new Error('Bonne réponse requise');
        if (!q.wrong1 || !q.wrong2 || !q.wrong3) {
            throw new Error('3 mauvaises réponses requises');
        }
        this.persist();
        return q;
    }
    deleteQuestion(questionId) {
        const id = String(questionId ?? '').trim();
        if (!id)
            throw new Error('Question requise');
        const before = this.data.questions.length;
        this.data.questions = this.data.questions.filter((x) => x.id !== id);
        if (this.data.questions.length === before) {
            throw new Error('Question introuvable');
        }
        this.persist();
    }
    ensureLoaded() {
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            if (!fs.existsSync(this.filePath)) {
                this.data = { categories: [], questions: [] };
                this.persist();
                return;
            }
            const raw = fs.readFileSync(this.filePath, 'utf-8');
            const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
            const categories = Array.isArray(parsed?.categories)
                ? parsed.categories
                : [];
            const questions = Array.isArray(parsed?.questions)
                ? parsed.questions
                : [];
            this.data = { categories, questions };
        }
        catch (err) {
            this.logger.warn(`Impossible de charger ${this.filePath}: ${err.message}`);
            this.data = { categories: [], questions: [] };
        }
    }
    persist() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const tmp = `${this.filePath}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2) + '\n', 'utf-8');
        fs.renameSync(tmp, this.filePath);
    }
    ensureUniqueId(base) {
        const clean = String(base ?? '').trim();
        if (!clean)
            throw new Error('Id invalide');
        let candidate = clean;
        let attempt = 1;
        while (this.data.categories.some((c) => c.id === candidate)) {
            candidate = `${clean}-${attempt++}`;
        }
        return candidate;
    }
    slugify(value) {
        const normalized = String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
};
exports.MnemoQuizStoreService = MnemoQuizStoreService;
exports.MnemoQuizStoreService = MnemoQuizStoreService = MnemoQuizStoreService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MnemoQuizStoreService);
//# sourceMappingURL=mnemo-quiz-store.service.js.map