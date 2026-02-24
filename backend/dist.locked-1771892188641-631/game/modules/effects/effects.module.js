"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EffectsModule = void 0;
const common_1 = require("@nestjs/common");
const effects_service_1 = require("./services/effects.service");
const tile_effect_registry_service_1 = require("./services/tile-effect-registry.service");
const pending_requirement_service_1 = require("./services/pending-requirement.service");
const stand_effect_registry_service_1 = require("./services/stand-effect-registry.service");
const game_module_overview_constants_1 = require("../game-module-overview.constants");
const effectsOverviewProvider = {
    provide: game_module_overview_constants_1.GAME_MODULE_OVERVIEW,
    useExisting: effects_service_1.EffectsService,
};
let EffectsModule = class EffectsModule {
};
exports.EffectsModule = EffectsModule;
exports.EffectsModule = EffectsModule = __decorate([
    (0, common_1.Module)({
        providers: [
            effects_service_1.EffectsService,
            tile_effect_registry_service_1.TileEffectRegistryService,
            pending_requirement_service_1.PendingRequirementService,
            stand_effect_registry_service_1.StandEffectRegistryService,
            effectsOverviewProvider,
        ],
        exports: [
            effects_service_1.EffectsService,
            tile_effect_registry_service_1.TileEffectRegistryService,
            pending_requirement_service_1.PendingRequirementService,
            stand_effect_registry_service_1.StandEffectRegistryService,
            effectsOverviewProvider,
        ],
    })
], EffectsModule);
//# sourceMappingURL=effects.module.js.map