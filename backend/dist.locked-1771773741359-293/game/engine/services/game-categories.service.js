"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var GameCategoriesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameCategoriesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const game_category_assignment_entity_1 = require("../entities/game-category-assignment.entity");
const game_category_entity_1 = require("../entities/game-category.entity");
const game_categories_fs_mirror_service_1 = require("./game-categories-fs-mirror.service");
let GameCategoriesService = class GameCategoriesService {
    static { GameCategoriesService_1 = this; }
    categoriesRepo;
    assignmentsRepo;
    mirror;
    logger = new common_1.Logger(GameCategoriesService_1.name);
    cache = null;
    static AliasToCategoryId = {
        galopant: 'vents-sacres',
        'les-vents-sacres': 'vents-sacres',
        'vents-sacres': 'vents-sacres',
        'vent-sacres': 'vents-sacres',
        'vents-sacre': 'vents-sacres',
        'etagere-des-vents-sacres': 'vents-sacres',
    };
    constructor(categoriesRepo, assignmentsRepo, mirror) {
        this.categoriesRepo = categoriesRepo;
        this.assignmentsRepo = assignmentsRepo;
        this.mirror = mirror;
    }
    async onModuleInit() {
        await this.ensureLoaded();
    }
    getCategories() {
        return [...this.getRoot().categories];
    }
    getCategory(id) {
        if (!id)
            return undefined;
        return this.getRoot().categories.find((category) => category.id === id);
    }
    getAssignment(gameType) {
        if (!gameType)
            return null;
        const raw = this.getRoot().assignments[gameType] ?? null;
        if (!raw)
            return null;
        const trimmed = String(raw).trim();
        if (!trimmed)
            return null;
        const root = this.getRoot();
        const normalized = this.slugify(this.normalizeLabel(trimmed));
        const canonical = GameCategoriesService_1.AliasToCategoryId[normalized] ?? normalized;
        if (root.categories.some((c) => c.id === canonical)) {
            return canonical;
        }
        if (root.categories.some((c) => c.id === normalized)) {
            return normalized;
        }
        return trimmed;
    }
    listAssignments() {
        return { ...this.getRoot().assignments };
    }
    async assignCategory(gameType, categoryId) {
        if (!gameType || !gameType.trim()) {
            throw new Error('gameType requis');
        }
        await this.ensureLoaded();
        const root = this.getRoot();
        const normalizedCategoryId = typeof categoryId === 'string' ? categoryId.trim() : categoryId;
        const nextCategoryId = normalizedCategoryId === '' ? null : (normalizedCategoryId ?? null);
        if (nextCategoryId && !this.getCategory(nextCategoryId)) {
            throw new Error(`Catégorie inconnue : ${nextCategoryId}`);
        }
        root.assignments[gameType] = nextCategoryId;
        await this.assignmentsRepo.save({
            gameType,
            categoryId: nextCategoryId,
        });
        this.cache = root;
        await this.syncMirrorBestEffort();
    }
    async createCategory(name, parentId) {
        const trimmed = (name ?? '').trim();
        if (!trimmed) {
            throw new Error('Nom de catégorie requis');
        }
        await this.ensureLoaded();
        const root = this.getRoot();
        const normalizedParentId = typeof parentId === 'string' ? parentId.trim() : parentId;
        const actualParentId = normalizedParentId === '' ? null : (normalizedParentId ?? null);
        if (actualParentId && !this.getCategory(actualParentId)) {
            throw new Error(`Catégorie parente introuvable : ${actualParentId}`);
        }
        const slug = this.ensureUniqueId(trimmed, root.categories);
        const category = {
            id: slug,
            name: trimmed,
            parentId: actualParentId,
            enabled: true,
        };
        root.categories.push(category);
        await this.categoriesRepo.insert({
            id: category.id,
            name: category.name,
            parentId: category.parentId,
            enabled: category.enabled,
        });
        this.cache = root;
        await this.syncMirrorBestEffort();
        return category;
    }
    async updateCategory(id, data) {
        if (!id || !id.trim()) {
            throw new Error('Identifiant requis');
        }
        await this.ensureLoaded();
        const root = this.getRoot();
        const category = root.categories.find((item) => item.id === id);
        if (!category) {
            throw new Error(`Catégorie inconnue : ${id}`);
        }
        if (data.name !== undefined) {
            const trimmed = data.name?.trim() ?? '';
            if (!trimmed) {
                throw new Error('Nom de catégorie requis');
            }
            category.name = trimmed;
        }
        if (data.parentId !== undefined) {
            const normalizedParentId = typeof data.parentId === 'string'
                ? data.parentId.trim()
                : data.parentId;
            const targetParentId = normalizedParentId === '' ? null : (normalizedParentId ?? null);
            if (targetParentId && !this.getCategory(targetParentId)) {
                throw new Error(`Catégorie parente introuvable : ${targetParentId}`);
            }
            if (targetParentId === category.id) {
                throw new Error('Une catégorie ne peut pas être sa propre parente.');
            }
            category.parentId = targetParentId;
        }
        await this.categoriesRepo.update({ id }, { name: category.name, parentId: category.parentId });
        this.cache = root;
        await this.syncMirrorBestEffort();
        return category;
    }
    async deleteCategory(id) {
        const key = String(id ?? '').trim();
        if (!key)
            throw new Error('Identifiant requis');
        await this.ensureLoaded();
        const root = this.getRoot();
        const existing = root.categories.find((c) => c.id === key);
        if (!existing) {
            throw new Error(`Catégorie inconnue : ${key}`);
        }
        await this.assignmentsRepo.update({ categoryId: key }, { categoryId: null });
        await this.categoriesRepo.delete({ id: key });
        root.categories = root.categories.filter((c) => c.id !== key);
        for (const [gameType, categoryId] of Object.entries(root.assignments)) {
            if (categoryId === key) {
                root.assignments[gameType] = null;
            }
        }
        this.cache = root;
        await this.syncMirrorBestEffort();
        await this.mirror.deleteCategory(key);
    }
    applyToDefinition(def) {
        const assignment = this.getAssignment(def.id);
        if (assignment) {
            const assigned = this.getCategory(assignment);
            if (assigned && assigned.enabled !== false) {
                return { ...def, category: assigned.name, subcategory: undefined };
            }
        }
        const inferred = this.inferCategoryFromDefinition(def);
        if (!inferred) {
            return def;
        }
        return { ...def, category: inferred.name, subcategory: undefined };
    }
    inferCategoryFromDefinition(def) {
        const raw = (def.subcategory || def.category || '').trim();
        if (!raw) {
            return undefined;
        }
        const root = this.getRoot();
        const normalizedId = this.slugify(this.normalizeLabel(raw));
        if (!normalizedId) {
            return undefined;
        }
        const aliasToCategoryId = {
            galopant: 'vents-sacres',
            'les-vents-sacres': 'vents-sacres',
            'vents-sacres': 'vents-sacres',
            'vent-sacres': 'vents-sacres',
            'vents-sacre': 'vents-sacres',
            'etagere-des-vents-sacres': 'vents-sacres',
        };
        const targetId = aliasToCategoryId[normalizedId] ?? normalizedId;
        const direct = root.categories.find((c) => c.enabled !== false && c.id === targetId);
        if (direct) {
            return direct;
        }
        const suffix = `-${targetId}`;
        const matches = root.categories.filter((c) => c.enabled !== false && c.id.endsWith(suffix));
        return matches.length === 1 ? matches[0] : undefined;
    }
    normalizeLabel(value) {
        return (value ?? '')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .trim();
    }
    getRoot() {
        return this.cache ?? { categories: [], assignments: {} };
    }
    async ensureLoaded() {
        if (this.cache)
            return;
        try {
            const categoriesRows = await this.categoriesRepo.find();
            const assignmentsRows = await this.assignmentsRepo.find();
            const categories = categoriesRows.map((row) => ({
                id: row.id,
                name: row.name,
                parentId: row.parentId ?? null,
                enabled: row.enabled !== false,
            }));
            const assignments = {};
            for (const row of assignmentsRows) {
                assignments[row.gameType] = row.categoryId ?? null;
            }
            this.cache = { categories, assignments };
            await this.syncMirrorBestEffort();
        }
        catch (error) {
            this.logger.warn(`Impossible de charger les catégories: ${error.message}`);
            this.cache = { categories: [], assignments: {} };
        }
    }
    async syncMirrorBestEffort() {
        try {
            const root = this.getRoot();
            await this.mirror.syncAll({
                categories: root.categories,
                assignments: root.assignments,
            });
        }
        catch (err) {
            this.logger.debug(`Sync miroir ignorée: ${err.message}`, err);
        }
    }
    ensureUniqueId(name, existing) {
        const base = this.slugify(name);
        if (!base) {
            throw new Error('Nom invalide');
        }
        let candidate = base;
        let attempt = 1;
        while (existing.some((category) => category.id === candidate)) {
            candidate = `${base}-${attempt++}`;
        }
        return candidate;
    }
    slugify(value) {
        const normalized = value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
};
exports.GameCategoriesService = GameCategoriesService;
exports.GameCategoriesService = GameCategoriesService = GameCategoriesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(game_category_entity_1.GameCategoryEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(game_category_assignment_entity_1.GameCategoryAssignmentEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        game_categories_fs_mirror_service_1.GameCategoriesFsMirrorService])
], GameCategoriesService);
//# sourceMappingURL=game-categories.service.js.map