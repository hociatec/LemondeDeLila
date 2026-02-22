"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZigEtZagModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const zig_et_zag_action_service_1 = require("./actions/zig-et-zag-action.service");
const zig_et_zag_bot_service_1 = require("./bots/zig-et-zag-bot.service");
const zig_et_zag_presenter_service_1 = require("./presenter/zig-et-zag-presenter.service");
const zig_et_zag_setup_service_1 = require("./setup/zig-et-zag-setup.service");
const zig_et_zag_service_1 = require("./zig-et-zag.service");
let ZigEtZagModule = class ZigEtZagModule {
};
exports.ZigEtZagModule = ZigEtZagModule;
exports.ZigEtZagModule = ZigEtZagModule = __decorate([
    (0, common_1.Module)({
        imports: [board_game_kits_module_1.BoardGameCoreKitModule, core_module_1.GameCoreModule, game_registry_module_1.GameRegistryModule],
        providers: [
            zig_et_zag_service_1.ZigEtZagService,
            zig_et_zag_setup_service_1.ZigEtZagSetupService,
            zig_et_zag_action_service_1.ZigEtZagActionService,
            zig_et_zag_presenter_service_1.ZigEtZagPresenterService,
            zig_et_zag_bot_service_1.ZigEtZagBotService,
        ],
        exports: [zig_et_zag_service_1.ZigEtZagService],
    })
], ZigEtZagModule);
//# sourceMappingURL=zig-et-zag.module.js.map