"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "EffectsModule", {
    enumerable: true,
    get: function() {
        return EffectsModule;
    }
});
const _common = require("@nestjs/common");
const _effectsservice = require("./services/effects.service");
const _tileeffectregistryservice = require("./services/tile-effect-registry.service");
const _pendingrequirementservice = require("./services/pending-requirement.service");
const _standeffectregistryservice = require("./services/stand-effect-registry.service");
const _gamemoduleoverviewconstants = require("../game-module-overview.constants");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
const effectsOverviewProvider = {
    provide: _gamemoduleoverviewconstants.GAME_MODULE_OVERVIEW,
    useExisting: _effectsservice.EffectsService
};
let EffectsModule = class EffectsModule {
};
EffectsModule = _ts_decorate([
    (0, _common.Module)({
        providers: [
            _effectsservice.EffectsService,
            _tileeffectregistryservice.TileEffectRegistryService,
            _pendingrequirementservice.PendingRequirementService,
            _standeffectregistryservice.StandEffectRegistryService,
            effectsOverviewProvider
        ],
        exports: [
            _effectsservice.EffectsService,
            _tileeffectregistryservice.TileEffectRegistryService,
            _pendingrequirementservice.PendingRequirementService,
            _standeffectregistryservice.StandEffectRegistryService,
            effectsOverviewProvider
        ]
    })
], EffectsModule);
