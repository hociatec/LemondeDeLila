"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "StateMachineService", {
    enumerable: true,
    get: function() {
        return StateMachineService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let StateMachineService = class StateMachineService {
    advance(state, steps, currentStepId, maxIterations = 20) {
        if (!steps.length) {
            return {
                state,
                stepId: currentStepId
            };
        }
        const stepIndex = steps.findIndex((s)=>s.id === currentStepId);
        let idx = stepIndex >= 0 ? stepIndex : 0;
        let iter = 0;
        const nextState = state;
        while(iter++ < maxIterations){
            const step = steps[idx] ?? steps[0];
            if (!step.canEnter || step.canEnter(nextState)) {
                const updated = step.onEnter ? step.onEnter(nextState) : nextState;
                return {
                    state: updated,
                    stepId: step.id
                };
            }
            idx = (idx + 1) % steps.length;
        }
        this.logger.warn(`StateMachine: boucle détectée après ${maxIterations} itérations (step=${currentStepId})`);
        return {
            state: nextState,
            stepId: currentStepId
        };
    }
    constructor(){
        this.logger = new _common.Logger(StateMachineService.name);
    }
};
StateMachineService = _ts_decorate([
    (0, _common.Injectable)()
], StateMachineService);
