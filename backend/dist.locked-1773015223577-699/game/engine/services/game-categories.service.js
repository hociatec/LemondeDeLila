"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameCategoriesService", {
    enumerable: true,
    get: function() {
        return GameCategoriesService;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _gamecategoryassignmententity = require("../entities/game-category-assignment.entity");
const _gamecategoryentity = require("../entities/game-category.entity");
const _gamecategoriesfsmirrorservice = require("./game-categories-fs-mirror.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let GameCategoriesService = class GameCategoriesService {
    async onModuleInit() {
        await this.ensureLoaded();
    }
    getCategories() {
        return [
            ...this.getRoot().categories
        ];
    }
    getCategory(id) {
        if (!id) return undefined;
        return this.getRoot().categories.find((category)=>category.id === id);
    }
    getAssignment(gameType) {
        if (!gameType) return null;
        const raw = this.getRoot().assignments[gameType] ?? null;
        if (!raw) return null;
        const trimmed = String(raw).trim();
        if (!trimmed) return null;
        const root = this.getRoot();
        const normalized = this.slugify(this.normalizeLabel(trimmed));
        const canonical = GameCategoriesService.AliasToCategoryId[normalized] ?? normalized;
        // Ne mappe vers l'id canonique que s'il existe réellement (sinon on garde l'id brut).
        if (root.categories.some((c)=>c.id === canonical)) {
            return canonical;
        }
        if (root.categories.some((c)=>c.id === normalized)) {
            return normalized;
        }
        return trimmed;
    }
    listAssignments() {
        return {
            ...this.getRoot().assignments
        };
    }
    async assignCategory(gameType, categoryId) {
        if (!gameType || !gameType.trim()) {
            throw new Error('gameType requis');
        }
        await this.ensureLoaded();
        const root = this.getRoot();
        const normalizedCategoryId = typeof categoryId === 'string' ? categoryId.trim() : categoryId;
        const nextCategoryId = normalizedCategoryId === '' ? null : normalizedCategoryId ?? null;
        if (nextCategoryId && !this.getCategory(nextCategoryId)) {
            throw new Error(`Catégorie inconnue : ${nextCategoryId}`);
        }
        root.assignments[gameType] = nextCategoryId;
        await this.assignmentsRepo.save({
            gameType,
            categoryId: nextCategoryId
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
        const actualParentId = normalizedParentId === '' ? null : normalizedParentId ?? null;
        if (actualParentId && !this.getCategory(actualParentId)) {
            throw new Error(`Catégorie parente introuvable : ${actualParentId}`);
        }
        const slug = this.ensureUniqueId(trimmed, root.categories);
        const category = {
            id: slug,
            name: trimmed,
            parentId: actualParentId,
            enabled: true
        };
        root.categories.push(category);
        await this.categoriesRepo.insert({
            id: category.id,
            name: category.name,
            parentId: category.parentId,
            enabled: category.enabled
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
        const category = root.categories.find((item)=>item.id === id);
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
            const normalizedParentId = typeof data.parentId === 'string' ? data.parentId.trim() : data.parentId;
            const targetParentId = normalizedParentId === '' ? null : normalizedParentId ?? null;
            if (targetParentId && !this.getCategory(targetParentId)) {
                throw new Error(`Catégorie parente introuvable : ${targetParentId}`);
            }
            if (targetParentId === category.id) {
                throw new Error('Une catégorie ne peut pas être sa propre parente.');
            }
            category.parentId = targetParentId;
        }
        await this.categoriesRepo.update({
            id
        }, {
            name: category.name,
            parentId: category.parentId
        });
        this.cache = root;
        await this.syncMirrorBestEffort();
        return category;
    }
    async deleteCategory(id) {
        const key = String(id ?? '').trim();
        if (!key) throw new Error('Identifiant requis');
        await this.ensureLoaded();
        const root = this.getRoot();
        const existing = root.categories.find((c)=>c.id === key);
        if (!existing) {
            throw new Error(`Catégorie inconnue : ${key}`);
        }
        // Détacher les jeux affectés (null).
        await this.assignmentsRepo.update({
            categoryId: key
        }, {
            categoryId: null
        });
        await this.categoriesRepo.delete({
            id: key
        });
        root.categories = root.categories.filter((c)=>c.id !== key);
        for (const [gameType, categoryId] of Object.entries(root.assignments)){
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
                return {
                    ...def,
                    category: assigned.name,
                    subcategory: undefined
                };
            }
        }
        // Fallback: si aucune affectation explicite n'existe, on tente de mapper automatiquement
        // la catégorie/sous-catégorie "technique" (ex: VentsInfinis) vers une catégorie admin existante.
        // Cela permet de renommer les étagères de la taverne sans devoir affecter chaque jeu manuellement.
        const inferred = this.inferCategoryFromDefinition(def);
        if (!inferred) {
            return def;
        }
        return {
            ...def,
            category: inferred.name,
            subcategory: undefined
        };
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
        // Alias: certains jeux historiques utilisent des libellés "marketing" ou des ids legacy
        // qui ne correspondent pas aux ids techniques des catégories DB.
        const aliasToCategoryId = {
            // Legacy: ancien id DB `galopant` -> `vents-sacres`.
            galopant: 'vents-sacres',
            // Variantes de libellés.
            'les-vents-sacres': 'vents-sacres',
            'vents-sacres': 'vents-sacres',
            'vent-sacres': 'vents-sacres',
            'vents-sacre': 'vents-sacres',
            'etagere-des-vents-sacres': 'vents-sacres'
        };
        const targetId = aliasToCategoryId[normalizedId] ?? normalizedId;
        // 1) Match exact sur l'id (recommandé).
        const direct = root.categories.find((c)=>c.enabled !== false && c.id === targetId);
        if (direct) {
            return direct;
        }
        // 2) Match suffixe (ex: les-vents-infinis -> vents-infinis).
        const suffix = `-${targetId}`;
        const matches = root.categories.filter((c)=>c.enabled !== false && c.id.endsWith(suffix));
        return matches.length === 1 ? matches[0] : undefined;
    }
    normalizeLabel(value) {
        return (value ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
    }
    getRoot() {
        return this.cache ?? {
            categories: [],
            assignments: {}
        };
    }
    async ensureLoaded() {
        if (this.cache) return;
        try {
            const categoriesRows = await this.categoriesRepo.find();
            const assignmentsRows = await this.assignmentsRepo.find();
            const categories = categoriesRows.map((row)=>({
                    id: row.id,
                    name: row.name,
                    parentId: row.parentId ?? null,
                    enabled: row.enabled !== false
                }));
            const assignments = {};
            for (const row of assignmentsRows){
                assignments[row.gameType] = row.categoryId ?? null;
            }
            this.cache = {
                categories,
                assignments
            };
            await this.syncMirrorBestEffort();
        } catch (error) {
            this.logger.warn(`Impossible de charger les catégories: ${error.message}`);
            this.cache = {
                categories: [],
                assignments: {}
            };
        }
    }
    async syncMirrorBestEffort() {
        try {
            const root = this.getRoot();
            await this.mirror.syncAll({
                categories: root.categories,
                assignments: root.assignments
            });
        } catch (err) {
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
        while(existing.some((category)=>category.id === candidate)){
            candidate = `${base}-${attempt++}`;
        }
        return candidate;
    }
    slugify(value) {
        const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    constructor(categoriesRepo, assignmentsRepo, mirror){
        this.categoriesRepo = categoriesRepo;
        this.assignmentsRepo = assignmentsRepo;
        this.mirror = mirror;
        this.logger = new _common.Logger(GameCategoriesService.name);
        this.cache = null;
    }
};
// Alias: ids legacy/variantes d'écriture -> id canonique (évite les doublons dans le catalogue).
GameCategoriesService.AliasToCategoryId = {
    // Legacy: ancien id DB `galopant` -> `vents-sacres`.
    galopant: 'vents-sacres',
    // Variantes de libellés/ids.
    'les-vents-sacres': 'vents-sacres',
    'vents-sacres': 'vents-sacres',
    'vent-sacres': 'vents-sacres',
    'vents-sacre': 'vents-sacres',
    'etagere-des-vents-sacres': 'vents-sacres'
};
GameCategoriesService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(0, (0, _typeorm.InjectRepository)(_gamecategoryentity.GameCategoryEntity)),
    _ts_param(1, (0, _typeorm.InjectRepository)(_gamecategoryassignmententity.GameCategoryAssignmentEntity)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository,
        typeof _gamecategoriesfsmirrorservice.GameCategoriesFsMirrorService === "undefined" ? Object : _gamecategoriesfsmirrorservice.GameCategoriesFsMirrorService
    ])
], GameCategoriesService);
