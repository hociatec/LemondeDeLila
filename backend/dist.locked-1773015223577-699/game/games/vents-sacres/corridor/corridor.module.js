"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CorridorModule", {
    enumerable: true,
    get: function() {
        return CorridorModule;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _corridorservice = require("./corridor.service");
const _corridorsetupservice = require("./setup/corridor-setup.service");
const _corridoractionservice = require("./actions/corridor-action.service");
const _corridorpresenterservice = require("./presenter/corridor-presenter.service");
const _corridorbotservice = require("./bots/corridor-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let CorridorModule = class CorridorModule {
};
CorridorModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _config.ConfigModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _boardgamekitsmodule.GridGameBotKitModule
        ],
        providers: [
            _corridorservice.CorridorService,
            _corridorsetupservice.CorridorSetupService,
            _corridoractionservice.CorridorActionService,
            _corridorpresenterservice.CorridorPresenterService,
            _corridorbotservice.CorridorBotService
        ],
        exports: [
            _corridorservice.CorridorService
        ]
    })
], CorridorModule);
