"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LamaModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const lama_presenter_1 = require("./lama.presenter");
const lama_service_1 = require("./lama.service");
const lama_shared_service_1 = require("./shared/lama-shared.service");
const lama_round_service_1 = require("./round/lama-round.service");
const lama_setup_service_1 = require("./setup/lama-setup.service");
const lama_action_service_1 = require("./actions/lama-action.service");
const lama_draw_service_1 = require("./actions/lama-draw.service");
const lama_pass_service_1 = require("./actions/lama-pass.service");
const lama_play_service_1 = require("./actions/lama-play.service");
const lama_quit_service_1 = require("./actions/lama-quit.service");
const lama_return_service_1 = require("./actions/lama-return.service");
const lama_info_service_1 = require("./actions/lama-info.service");
const lama_bot_service_1 = require("./bots/lama-bot.service");
const lama_shortcuts_service_1 = require("./shortcuts/lama-shortcuts.service");
const lama_log_service_1 = require("./logging/lama-log.service");
let LamaModule = class LamaModule {
};
exports.LamaModule = LamaModule;
exports.LamaModule = LamaModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            core_module_1.GameCoreModule,
            game_registry_module_1.GameRegistryModule,
            board_game_kits_module_1.RandomGameCoreKitModule,
        ],
        providers: [
            lama_service_1.LamaService,
            lama_presenter_1.LamaPresenter,
            lama_shared_service_1.LamaSharedService,
            lama_round_service_1.LamaRoundService,
            lama_setup_service_1.LamaSetupService,
            lama_action_service_1.LamaActionService,
            lama_draw_service_1.LamaDrawService,
            lama_pass_service_1.LamaPassService,
            lama_play_service_1.LamaPlayService,
            lama_quit_service_1.LamaQuitService,
            lama_return_service_1.LamaReturnService,
            lama_info_service_1.LamaInfoService,
            lama_bot_service_1.LamaBotService,
            lama_shortcuts_service_1.LamaShortcutsService,
            lama_log_service_1.LamaLogService,
        ],
        exports: [lama_service_1.LamaService],
    })
], LamaModule);
//# sourceMappingURL=lama.module.js.map