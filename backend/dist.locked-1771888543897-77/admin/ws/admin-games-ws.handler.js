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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminGamesWsHandler = void 0;
const common_1 = require("@nestjs/common");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const game_categories_service_1 = require("../../game/engine/services/game-categories.service");
const game_catalog_overrides_service_1 = require("../../game/engine/services/game-catalog-overrides.service");
const game_registry_service_1 = require("../../game/engine/services/game-registry.service");
const admin_catalog_invalidation_service_1 = require("../services/admin-catalog-invalidation.service");
const admin_ws_dto_1 = require("./admin-ws.dto");
let AdminGamesWsHandler = class AdminGamesWsHandler {
    validator;
    registry;
    overrides;
    categories;
    catalogInvalidation;
    constructor(validator, registry, overrides, categories, catalogInvalidation) {
        this.validator = validator;
        this.registry = registry;
        this.overrides = overrides;
        this.categories = categories;
        this.catalogInvalidation = catalogInvalidation;
    }
    buildCategoriesPayload() {
        return {
            categories: this.categories.getCategories(),
            assignments: this.categories.listAssignments(),
        };
    }
    async gamesList(session) {
        (0, ws_auth_1.requireAdmin)(session);
        const games = await this.registry.listGames({
            includeDisabledOverrides: true,
        });
        const payload = games
            .map((g) => {
            const ov = this.overrides.getGameOverride(g.id);
            const enabled = ov?.enabled !== false;
            const chatEnabled = typeof ov?.chatEnabled === 'boolean'
                ? ov.chatEnabled
                : typeof g.chatEnabled === 'boolean'
                    ? g.chatEnabled
                    : true;
            const chatSoundsEnabled = typeof ov?.chatSoundsEnabled === 'boolean'
                ? ov.chatSoundsEnabled
                : typeof g.chatSoundsEnabled === 'boolean'
                    ? g.chatSoundsEnabled
                    : true;
            const status = ov?.status ?? 'finished';
            const categoryId = this.categories.getAssignment(g.id);
            return {
                id: g.id,
                name: g.name,
                category: g.category,
                categoryId: categoryId ?? undefined,
                subcategory: g.subcategory,
                description: g.description,
                rules: ov?.rules ?? undefined,
                minPlayers: g.minPlayers,
                maxPlayers: g.maxPlayers,
                enabled,
                status,
                chatEnabled,
                chatSoundsEnabled,
            };
        })
            .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        return { type: 'admin.games.list', payload: { games: payload } };
    }
    gamesCategoriesList(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        this.validator.validate(admin_ws_dto_1.AdminGameCategoriesListWsDto, payload ?? {});
        return {
            type: 'admin.games.categories',
            payload: this.buildCategoriesPayload(),
        };
    }
    async gamesCategoryCreate(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminGameCategoryCreateWsDto, payload);
        await this.categories.createCategory(dto.name, dto.parentId ?? null);
        await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
        return {
            type: 'admin.games.categories',
            payload: this.buildCategoriesPayload(),
        };
    }
    async gamesCategoryUpdate(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminGameCategoryUpdateWsDto, payload);
        await this.categories.updateCategory(dto.id, {
            name: dto.name,
            parentId: dto.parentId ?? null,
        });
        await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
        return {
            type: 'admin.games.categories',
            payload: this.buildCategoriesPayload(),
        };
    }
    async gamesCategoryAssign(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminGameCategoryAssignWsDto, payload);
        await this.categories.assignCategory(dto.gameType, dto.categoryId ?? null);
        await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
        return {
            type: 'admin.games.category.assign',
            payload: this.buildCategoriesPayload(),
        };
    }
    async gamesCategoryDelete(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminGameCategoryDeleteWsDto, payload);
        await this.categories.deleteCategory(dto.id);
        await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
        return {
            type: 'admin.games.categories',
            payload: this.buildCategoriesPayload(),
        };
    }
    async gamesSetEnabled(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminGameSetEnabledWsDto, payload);
        await this.overrides.setEnabled(dto.gameType, dto.enabled);
        await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
        return { type: 'admin.games.setEnabled', payload: { ok: true } };
    }
    async gamesUpdate(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminGameUpdateWsDto, payload);
        const update = {};
        if (typeof dto.enabled === 'boolean')
            update.enabled = dto.enabled;
        if (typeof dto.minPlayers === 'number')
            update.minPlayers = dto.minPlayers;
        if (typeof dto.maxPlayers === 'number')
            update.maxPlayers = dto.maxPlayers;
        if (typeof dto.name === 'string')
            update.name = dto.name;
        if (typeof dto.description === 'string')
            update.description = dto.description;
        if (typeof dto.rules === 'string')
            update.rules = dto.rules;
        if (typeof dto.status === 'string')
            update.status = dto.status;
        if (typeof dto.chatEnabled === 'boolean')
            update.chatEnabled = dto.chatEnabled;
        if (typeof dto.chatSoundsEnabled === 'boolean')
            update.chatSoundsEnabled = dto.chatSoundsEnabled;
        await this.overrides.updateGameOverride(dto.gameType, update);
        await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
        return { type: 'admin.games.update', payload: { ok: true } };
    }
    async gamesReset(session, payload) {
        const admin = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminGameResetWsDto, payload);
        await this.overrides.clearGameOverride(dto.gameType);
        await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
        return { type: 'admin.games.reset', payload: { ok: true } };
    }
};
exports.AdminGamesWsHandler = AdminGamesWsHandler;
exports.AdminGamesWsHandler = AdminGamesWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [payload_validation_service_1.PayloadValidationService,
        game_registry_service_1.GameRegistryService,
        game_catalog_overrides_service_1.GameCatalogOverridesService,
        game_categories_service_1.GameCategoriesService,
        admin_catalog_invalidation_service_1.AdminCatalogInvalidationService])
], AdminGamesWsHandler);
//# sourceMappingURL=admin-games-ws.handler.js.map