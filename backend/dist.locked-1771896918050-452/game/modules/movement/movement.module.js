"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovementModule = void 0;
const common_1 = require("@nestjs/common");
const movement_service_1 = require("./services/movement.service");
const game_module_overview_constants_1 = require("../game-module-overview.constants");
const movementOverviewProvider = {
    provide: game_module_overview_constants_1.GAME_MODULE_OVERVIEW,
    useExisting: movement_service_1.MovementService,
};
let MovementModule = class MovementModule {
};
exports.MovementModule = MovementModule;
exports.MovementModule = MovementModule = __decorate([
    (0, common_1.Module)({
        providers: [movement_service_1.MovementService, movementOverviewProvider],
        exports: [movement_service_1.MovementService, movementOverviewProvider],
    })
], MovementModule);
//# sourceMappingURL=movement.module.js.map