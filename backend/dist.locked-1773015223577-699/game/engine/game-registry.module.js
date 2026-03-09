"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameRegistryModule", {
    enumerable: true,
    get: function() {
        return GameRegistryModule;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _gamecatalogoverrideentity = require("./entities/game-catalog-override.entity");
const _gamecategoryassignmententity = require("./entities/game-category-assignment.entity");
const _gamecategoryentity = require("./entities/game-category.entity");
const _gameregistryservice = require("./services/game-registry.service");
const _gamecatalogoverridesservice = require("./services/game-catalog-overrides.service");
const _gamecategoriesservice = require("./services/game-categories.service");
const _gamecategoriesfsmirrorservice = require("./services/game-categories-fs-mirror.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let GameRegistryModule = class GameRegistryModule {
};
GameRegistryModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _typeorm.TypeOrmModule.forFeature([
                _gamecategoryentity.GameCategoryEntity,
                _gamecategoryassignmententity.GameCategoryAssignmentEntity,
                _gamecatalogoverrideentity.GameCatalogOverrideEntity
            ])
        ],
        providers: [
            _gameregistryservice.GameRegistryService,
            _gamecatalogoverridesservice.GameCatalogOverridesService,
            _gamecategoriesservice.GameCategoriesService,
            _gamecategoriesfsmirrorservice.GameCategoriesFsMirrorService
        ],
        exports: [
            _gameregistryservice.GameRegistryService,
            _gamecatalogoverridesservice.GameCatalogOverridesService,
            _gamecategoriesservice.GameCategoriesService
        ]
    })
], GameRegistryModule);
