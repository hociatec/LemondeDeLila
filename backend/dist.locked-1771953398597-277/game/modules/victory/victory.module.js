"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VictoryModule = void 0;
const common_1 = require("@nestjs/common");
const victory_service_1 = require("./services/victory.service");
const game_module_overview_constants_1 = require("../game-module-overview.constants");
const victoryOverviewProvider = {
    provide: game_module_overview_constants_1.GAME_MODULE_OVERVIEW,
    useExisting: victory_service_1.VictoryService,
};
let VictoryModule = class VictoryModule {
};
exports.VictoryModule = VictoryModule;
exports.VictoryModule = VictoryModule = __decorate([
    (0, common_1.Module)({
        providers: [victory_service_1.VictoryService, victoryOverviewProvider],
        exports: [victory_service_1.VictoryService, victoryOverviewProvider],
    })
], VictoryModule);
//# sourceMappingURL=victory.module.js.map