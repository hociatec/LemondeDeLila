"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TaxiExpressModule", {
    enumerable: true,
    get: function() {
        return TaxiExpressModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _taxiexpressservice = require("./taxi-express.service");
const _taxiexpresssetupservice = require("./setup/taxi-express-setup.service");
const _taxiexpressactionservice = require("./actions/taxi-express-action.service");
const _taxiexpresspresenterservice = require("./presenter/taxi-express-presenter.service");
const _taxiexpressbotservice = require("./bots/taxi-express-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let TaxiExpressModule = class TaxiExpressModule {
};
TaxiExpressModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule
        ],
        providers: [
            _taxiexpressservice.TaxiExpressService,
            _taxiexpresssetupservice.TaxiExpressSetupService,
            _taxiexpressactionservice.TaxiExpressActionService,
            _taxiexpresspresenterservice.TaxiExpressPresenterService,
            _taxiexpressbotservice.TaxiExpressBotService
        ],
        exports: [
            _taxiexpressservice.TaxiExpressService
        ]
    })
], TaxiExpressModule);
