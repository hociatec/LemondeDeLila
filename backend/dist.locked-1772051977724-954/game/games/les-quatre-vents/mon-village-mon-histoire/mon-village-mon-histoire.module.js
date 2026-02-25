"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MonVillageModule", {
    enumerable: true,
    get: function() {
        return MonVillageModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _monvillagemonhistoireservice = require("./mon-village-mon-histoire.service");
const _monvillagesetupservice = require("./setup/mon-village-setup.service");
const _monvillageactionservice = require("./actions/mon-village-action.service");
const _monvillagepresenterservice = require("./presenter/mon-village-presenter.service");
const _monvillagebotservice = require("./bots/mon-village-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let MonVillageModule = class MonVillageModule {
};
MonVillageModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule
        ],
        providers: [
            _monvillagemonhistoireservice.MonVillageService,
            _monvillagesetupservice.MonVillageSetupService,
            _monvillageactionservice.MonVillageActionService,
            _monvillagepresenterservice.MonVillagePresenterService,
            _monvillagebotservice.MonVillageBotService
        ],
        exports: [
            _monvillagemonhistoireservice.MonVillageService
        ]
    })
], MonVillageModule);
