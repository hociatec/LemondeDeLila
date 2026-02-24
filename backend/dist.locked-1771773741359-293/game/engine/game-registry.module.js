"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRegistryModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const game_catalog_override_entity_1 = require("./entities/game-catalog-override.entity");
const game_category_assignment_entity_1 = require("./entities/game-category-assignment.entity");
const game_category_entity_1 = require("./entities/game-category.entity");
const game_registry_service_1 = require("./services/game-registry.service");
const game_catalog_overrides_service_1 = require("./services/game-catalog-overrides.service");
const game_categories_service_1 = require("./services/game-categories.service");
const game_categories_fs_mirror_service_1 = require("./services/game-categories-fs-mirror.service");
let GameRegistryModule = class GameRegistryModule {
};
exports.GameRegistryModule = GameRegistryModule;
exports.GameRegistryModule = GameRegistryModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                game_category_entity_1.GameCategoryEntity,
                game_category_assignment_entity_1.GameCategoryAssignmentEntity,
                game_catalog_override_entity_1.GameCatalogOverrideEntity,
            ]),
        ],
        providers: [
            game_registry_service_1.GameRegistryService,
            game_catalog_overrides_service_1.GameCatalogOverridesService,
            game_categories_service_1.GameCategoriesService,
            game_categories_fs_mirror_service_1.GameCategoriesFsMirrorService,
        ],
        exports: [
            game_registry_service_1.GameRegistryService,
            game_catalog_overrides_service_1.GameCatalogOverridesService,
            game_categories_service_1.GameCategoriesService,
        ],
    })
], GameRegistryModule);
//# sourceMappingURL=game-registry.module.js.map