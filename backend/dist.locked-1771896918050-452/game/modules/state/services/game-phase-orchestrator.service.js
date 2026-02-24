"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamePhaseOrchestratorService = void 0;
const common_1 = require("@nestjs/common");
const phase_engine_service_1 = require("./phase-engine.service");
let GamePhaseOrchestratorService = class GamePhaseOrchestratorService {
    phases;
    constructor(phases) {
        this.phases = phases;
    }
    advance(params) {
        const { state, meta, phaseOrder, currentPhaseId, canEnter, onEnterSystemPhase, maxIterations, } = params;
        const definitions = (phaseOrder ?? []).map((phase) => ({
            id: phase.id,
            canEnter: canEnter ? (s, m) => canEnter(s, m, phase.id) : undefined,
            onEnter: phase.kind === 'system' && onEnterSystemPhase
                ? (s, m) => onEnterSystemPhase({ state: s, meta: m, phaseId: phase.id })
                : undefined,
        }));
        const result = this.phases.advance(state, meta, definitions, String(currentPhaseId), maxIterations);
        return { state: result.state, phaseId: result.phaseId };
    }
};
exports.GamePhaseOrchestratorService = GamePhaseOrchestratorService;
exports.GamePhaseOrchestratorService = GamePhaseOrchestratorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [phase_engine_service_1.PhaseEngineService])
], GamePhaseOrchestratorService);
//# sourceMappingURL=game-phase-orchestrator.service.js.map