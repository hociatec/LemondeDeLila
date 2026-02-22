"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuizModule = void 0;
const common_1 = require("@nestjs/common");
const quiz_service_1 = require("./services/quiz.service");
const quiz_runner_service_1 = require("./services/quiz-runner.service");
const game_module_overview_constants_1 = require("../game-module-overview.constants");
const quizOverviewProvider = {
    provide: game_module_overview_constants_1.GAME_MODULE_OVERVIEW,
    useExisting: quiz_service_1.QuizService,
};
let QuizModule = class QuizModule {
};
exports.QuizModule = QuizModule;
exports.QuizModule = QuizModule = __decorate([
    (0, common_1.Module)({
        providers: [quiz_service_1.QuizService, quiz_runner_service_1.QuizRunnerService, quizOverviewProvider],
        exports: [quiz_service_1.QuizService, quiz_runner_service_1.QuizRunnerService, quizOverviewProvider],
    })
], QuizModule);
//# sourceMappingURL=quiz.module.js.map