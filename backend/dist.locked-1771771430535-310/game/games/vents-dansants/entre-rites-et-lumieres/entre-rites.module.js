"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntreRitesModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../../../core/core.module");
const game_registry_module_1 = require("../../../engine/game-registry.module");
const board_game_kits_module_1 = require("../../../modules/game-kits/board-game-kits.module");
const entre_rites_action_service_1 = require("./actions/entre-rites-action.service");
const entre_rites_presenter_service_1 = require("./presenter/entre-rites-presenter.service");
const entre_rites_setup_service_1 = require("./setup/entre-rites-setup.service");
const entre_rites_service_1 = require("./entre-rites.service");
const entre_rites_bot_service_1 = require("./bots/entre-rites-bot.service");
let EntreRitesModule = class EntreRitesModule {
};
exports.EntreRitesModule = EntreRitesModule;
exports.EntreRitesModule = EntreRitesModule = __decorate([
    (0, common_1.Module)({
        imports: [board_game_kits_module_1.BoardGameDeckKitModule, core_module_1.GameCoreModule, game_registry_module_1.GameRegistryModule],
        providers: [
            entre_rites_service_1.EntreRitesService,
            entre_rites_setup_service_1.EntreRitesSetupService,
            entre_rites_action_service_1.EntreRitesActionService,
            entre_rites_presenter_service_1.EntreRitesPresenterService,
            entre_rites_bot_service_1.EntreRitesBotService,
        ],
        exports: [entre_rites_service_1.EntreRitesService],
    })
], EntreRitesModule);
//# sourceMappingURL=entre-rites.module.js.map