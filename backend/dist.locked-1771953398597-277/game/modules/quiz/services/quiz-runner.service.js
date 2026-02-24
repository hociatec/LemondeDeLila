"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuizRunnerService = void 0;
const common_1 = require("@nestjs/common");
let QuizRunnerService = class QuizRunnerService {
    setPending(state, playerId, question) {
        return {
            ...state,
            pending: { ...(state.pending ?? {}), [playerId]: question },
        };
    }
    clearPending(state, playerId) {
        const next = { ...(state.pending ?? {}) };
        delete next[playerId];
        return { ...state, pending: next };
    }
    validateAnswer(state, playerId, answer) {
        const q = (state.pending ?? {})[playerId];
        if (!q) {
            return { correct: false, state };
        }
        const correct = q.answer?.trim().toLowerCase() === (answer ?? '').trim().toLowerCase();
        const next = this.clearPending(state, playerId);
        return { correct, state: next };
    }
};
exports.QuizRunnerService = QuizRunnerService;
exports.QuizRunnerService = QuizRunnerService = __decorate([
    (0, common_1.Injectable)()
], QuizRunnerService);
//# sourceMappingURL=quiz-runner.service.js.map