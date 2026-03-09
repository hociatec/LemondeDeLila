"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ZigEtZagModule", {
    enumerable: true,
    get: function() {
        return ZigEtZagModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _zigetzagactionservice = require("./actions/zig-et-zag-action.service");
const _zigetzagbotservice = require("./bots/zig-et-zag-bot.service");
const _zigetzagpresenterservice = require("./presenter/zig-et-zag-presenter.service");
const _zigetzagsetupservice = require("./setup/zig-et-zag-setup.service");
const _zigetzagservice = require("./zig-et-zag.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let ZigEtZagModule = class ZigEtZagModule {
};
ZigEtZagModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameCoreKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule
        ],
        providers: [
            _zigetzagservice.ZigEtZagService,
            _zigetzagsetupservice.ZigEtZagSetupService,
            _zigetzagactionservice.ZigEtZagActionService,
            _zigetzagpresenterservice.ZigEtZagPresenterService,
            _zigetzagbotservice.ZigEtZagBotService
        ],
        exports: [
            _zigetzagservice.ZigEtZagService
        ]
    })
], ZigEtZagModule);
