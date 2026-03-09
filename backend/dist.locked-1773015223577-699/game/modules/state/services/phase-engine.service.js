"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PhaseEngineService", {
    enumerable: true,
    get: function() {
        return PhaseEngineService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let PhaseEngineService = class PhaseEngineService {
    advance(state, meta, phases, currentId, maxIterations = 20) {
        if (!phases.length) return {
            state,
            phaseId: currentId
        };
        const idxStart = Math.max(0, phases.findIndex((p)=>p.id === currentId));
        let idx = idxStart;
        let iter = 0;
        let next = state;
        while(iter++ < maxIterations){
            const phase = phases[idx] ?? phases[0];
            if (!phase.canEnter || phase.canEnter(next, meta)) {
                next = phase.onEnter ? phase.onEnter(next, meta) : next;
                return {
                    state: next,
                    phaseId: phase.id
                };
            }
            idx = (idx + 1) % phases.length;
        }
        this.logger.warn(`PhaseEngine: boucle détectée après ${maxIterations} itérations (phase=${currentId})`);
        return {
            state: next,
            phaseId: currentId
        };
    }
    constructor(){
        this.logger = new _common.Logger(PhaseEngineService.name);
    }
};
PhaseEngineService = _ts_decorate([
    (0, _common.Injectable)()
], PhaseEngineService);
