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
exports.PanierExpressQuizService = void 0;
const common_1 = require("@nestjs/common");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const quiz_runner_service_1 = require("../../../../modules/quiz/services/quiz-runner.service");
const deck_pool_service_1 = require("../../../../modules/cards/services/deck-pool.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const sanitize_text_1 = require("../../../../../common/utils/sanitize-text");
const panier_express_utils_service_1 = require("../model/panier-express-utils.service");
let PanierExpressQuizService = class PanierExpressQuizService {
    deckPool;
    quizRunner;
    core;
    utils;
    random;
    constructor(deckPool, quizRunner, core, utils, random) {
        this.deckPool = deckPool;
        this.quizRunner = quizRunner;
        this.core = core;
        this.utils = utils;
        this.random = random;
    }
    applyQuiz(state, playerId) {
        const meta = state.metadata;
        if (!meta.decks) {
            return this.core.appendLog(state, '[Panier Express] Quiz : deck indisponible.');
        }
        const metaRng = this.random.createMetaRng(meta);
        const { card, pool } = this.deckPool.draw(meta.decks, 'quizzes', metaRng.rng);
        let metadata = {
            ...metaRng.getMeta(),
            decks: pool,
        };
        const quiz = card;
        if (!quiz) {
            return this.core.appendLog(state, '[Panier Express] Quiz : aucune carte disponible.');
        }
        const question = (0, sanitize_text_1.sanitizeText)(quiz.question);
        const answer = (0, sanitize_text_1.sanitizeText)(String(quiz.answer ?? '')).trim();
        const rawChoices = Array.isArray(quiz.choices) ? quiz.choices : [];
        const unique = new Set();
        const normalizedChoices = [];
        for (const choice of rawChoices) {
            const text = (0, sanitize_text_1.sanitizeText)(String(choice)).trim();
            const key = text.toLowerCase();
            if (!text || unique.has(key))
                continue;
            unique.add(key);
            normalizedChoices.push(text);
        }
        if (answer) {
            const key = answer.toLowerCase();
            if (!unique.has(key)) {
                unique.add(key);
                normalizedChoices.push(answer);
            }
        }
        const shuffled = this.random.shuffle(metadata, normalizedChoices);
        metadata = shuffled.meta;
        const choices = shuffled.values;
        const currentQuizState = metadata.quiz ?? { pending: {} };
        const nextQuizState = this.quizRunner.setPending(currentQuizState, playerId, {
            id: quiz.id ?? `quiz-${playerId}`,
            question,
            answer,
            choices,
        });
        const nextMeta = {
            ...metadata,
            quiz: nextQuizState,
        };
        const next = { ...state, metadata: nextMeta };
        return this.core.appendLog(next, `Question pour ${this.utils.playerName(state, playerId)}: "${question}"`);
    }
};
exports.PanierExpressQuizService = PanierExpressQuizService;
exports.PanierExpressQuizService = PanierExpressQuizService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [deck_pool_service_1.DeckPoolService,
        quiz_runner_service_1.QuizRunnerService,
        game_core_service_1.GameCoreService,
        panier_express_utils_service_1.PanierExpressUtils,
        random_service_1.RandomService])
], PanierExpressQuizService);
//# sourceMappingURL=panier-express-quiz.service.js.map