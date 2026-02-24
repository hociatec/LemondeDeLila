"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateModule = void 0;
const common_1 = require("@nestjs/common");
const state_machine_service_1 = require("./services/state-machine.service");
const phase_engine_service_1 = require("./services/phase-engine.service");
const game_phase_orchestrator_service_1 = require("./services/game-phase-orchestrator.service");
let StateModule = class StateModule {
};
exports.StateModule = StateModule;
exports.StateModule = StateModule = __decorate([
    (0, common_1.Module)({
        providers: [
            state_machine_service_1.StateMachineService,
            phase_engine_service_1.PhaseEngineService,
            game_phase_orchestrator_service_1.GamePhaseOrchestratorService,
        ],
        exports: [
            state_machine_service_1.StateMachineService,
            phase_engine_service_1.PhaseEngineService,
            game_phase_orchestrator_service_1.GamePhaseOrchestratorService,
        ],
    })
], StateModule);
//# sourceMappingURL=state.module.js.map