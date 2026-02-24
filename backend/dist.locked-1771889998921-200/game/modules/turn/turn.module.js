"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurnModule = void 0;
const common_1 = require("@nestjs/common");
const turn_service_1 = require("./services/turn.service");
const turn_actions_service_1 = require("./services/turn-actions.service");
const turn_manager_service_1 = require("./services/turn-manager.service");
const turn_status_service_1 = require("./services/turn-status.service");
const turn_label_service_1 = require("./services/turn-label.service");
const turn_flow_service_1 = require("./services/turn-flow.service");
const turn_policies_module_1 = require("../turn-policies/turn-policies.module");
const game_module_overview_constants_1 = require("../game-module-overview.constants");
const turnOverviewProvider = {
    provide: game_module_overview_constants_1.GAME_MODULE_OVERVIEW,
    useExisting: turn_service_1.TurnService,
};
let TurnModule = class TurnModule {
};
exports.TurnModule = TurnModule;
exports.TurnModule = TurnModule = __decorate([
    (0, common_1.Module)({
        imports: [turn_policies_module_1.TurnPoliciesModule],
        providers: [
            turn_service_1.TurnService,
            turn_actions_service_1.TurnActionsService,
            turn_manager_service_1.TurnManagerService,
            turn_status_service_1.TurnStatusService,
            turn_label_service_1.TurnLabelService,
            turn_flow_service_1.TurnFlowService,
            turnOverviewProvider,
        ],
        exports: [
            turn_service_1.TurnService,
            turn_actions_service_1.TurnActionsService,
            turn_manager_service_1.TurnManagerService,
            turn_status_service_1.TurnStatusService,
            turn_label_service_1.TurnLabelService,
            turn_flow_service_1.TurnFlowService,
            turnOverviewProvider,
        ],
    })
], TurnModule);
//# sourceMappingURL=turn.module.js.map