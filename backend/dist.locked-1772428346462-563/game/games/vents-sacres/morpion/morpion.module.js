"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MorpionModule", {
    enumerable: true,
    get: function() {
        return MorpionModule;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _morpionpresenter = require("./morpion.presenter");
const _morpionservice = require("./morpion.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let MorpionModule = class MorpionModule {
};
MorpionModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _config.ConfigModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _boardgamekitsmodule.GridGameCoreKitModule
        ],
        providers: [
            _morpionservice.MorpionService,
            _morpionpresenter.MorpionPresenter
        ],
        exports: [
            _morpionservice.MorpionService
        ]
    })
], MorpionModule);
