"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaModule", {
    enumerable: true,
    get: function() {
        return LamaModule;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _lamapresenter = require("./lama.presenter");
const _lamaservice = require("./lama.service");
const _lamasharedservice = require("./shared/lama-shared.service");
const _lamaroundservice = require("./round/lama-round.service");
const _lamasetupservice = require("./setup/lama-setup.service");
const _lamaactionservice = require("./actions/lama-action.service");
const _lamadrawservice = require("./actions/lama-draw.service");
const _lamapassservice = require("./actions/lama-pass.service");
const _lamaplayservice = require("./actions/lama-play.service");
const _lamaquitservice = require("./actions/lama-quit.service");
const _lamareturnservice = require("./actions/lama-return.service");
const _lamainfoservice = require("./actions/lama-info.service");
const _lamabotservice = require("./bots/lama-bot.service");
const _lamashortcutsservice = require("./shortcuts/lama-shortcuts.service");
const _lamalogservice = require("./logging/lama-log.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let LamaModule = class LamaModule {
};
LamaModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _config.ConfigModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _boardgamekitsmodule.RandomGameCoreKitModule
        ],
        providers: [
            _lamaservice.LamaService,
            _lamapresenter.LamaPresenter,
            _lamasharedservice.LamaSharedService,
            _lamaroundservice.LamaRoundService,
            _lamasetupservice.LamaSetupService,
            _lamaactionservice.LamaActionService,
            _lamadrawservice.LamaDrawService,
            _lamapassservice.LamaPassService,
            _lamaplayservice.LamaPlayService,
            _lamaquitservice.LamaQuitService,
            _lamareturnservice.LamaReturnService,
            _lamainfoservice.LamaInfoService,
            _lamabotservice.LamaBotService,
            _lamashortcutsservice.LamaShortcutsService,
            _lamalogservice.LamaLogService
        ],
        exports: [
            _lamaservice.LamaService
        ]
    })
], LamaModule);
