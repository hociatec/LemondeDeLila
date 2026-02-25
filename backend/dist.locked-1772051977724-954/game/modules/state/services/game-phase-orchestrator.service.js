"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GamePhaseOrchestratorService", {
    enumerable: true,
    get: function() {
        return GamePhaseOrchestratorService;
    }
});
const _common = require("@nestjs/common");
const _phaseengineservice = require("./phase-engine.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let GamePhaseOrchestratorService = class GamePhaseOrchestratorService {
    advance(params) {
        const { state, meta, phaseOrder, currentPhaseId, canEnter, onEnterSystemPhase, maxIterations } = params;
        const definitions = (phaseOrder ?? []).map((phase)=>({
                id: phase.id,
                canEnter: canEnter ? (s, m)=>canEnter(s, m, phase.id) : undefined,
                onEnter: phase.kind === 'system' && onEnterSystemPhase ? (s, m)=>onEnterSystemPhase({
                        state: s,
                        meta: m,
                        phaseId: phase.id
                    }) : undefined
            }));
        const result = this.phases.advance(state, meta, definitions, String(currentPhaseId), maxIterations);
        return {
            state: result.state,
            phaseId: result.phaseId
        };
    }
    constructor(phases){
        this.phases = phases;
    }
};
GamePhaseOrchestratorService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _phaseengineservice.PhaseEngineService === "undefined" ? Object : _phaseengineservice.PhaseEngineService
    ])
], GamePhaseOrchestratorService);
