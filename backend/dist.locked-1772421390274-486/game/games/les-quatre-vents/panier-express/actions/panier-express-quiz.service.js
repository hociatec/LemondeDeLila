"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PanierExpressQuizService", {
    enumerable: true,
    get: function() {
        return PanierExpressQuizService;
    }
});
const _common = require("@nestjs/common");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _quizrunnerservice = require("../../../../modules/quiz/services/quiz-runner.service");
const _deckpoolservice = require("../../../../modules/cards/services/deck-pool.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _sanitizetext = require("../../../../../common/utils/sanitize-text");
const _panierexpressutilsservice = require("../model/panier-express-utils.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let PanierExpressQuizService = class PanierExpressQuizService {
    applyQuiz(state, playerId) {
        const meta = state.metadata;
        if (!meta.decks) {
            return this.core.appendLog(state, '[Panier Express] Quiz : deck indisponible.');
        }
        const metaRng = this.random.createMetaRng(meta);
        const { card, pool } = this.deckPool.draw(meta.decks, 'quizzes', metaRng.rng);
        let metadata = {
            ...metaRng.getMeta(),
            decks: pool
        };
        const quiz = card;
        if (!quiz) {
            return this.core.appendLog(state, '[Panier Express] Quiz : aucune carte disponible.');
        }
        const question = (0, _sanitizetext.sanitizeText)(quiz.question);
        const answer = (0, _sanitizetext.sanitizeText)(String(quiz.answer ?? '')).trim();
        const rawChoices = Array.isArray(quiz.choices) ? quiz.choices : [];
        const unique = new Set();
        const normalizedChoices = [];
        for (const choice of rawChoices){
            const text = (0, _sanitizetext.sanitizeText)(String(choice)).trim();
            const key = text.toLowerCase();
            if (!text || unique.has(key)) continue;
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
        const currentQuizState = metadata.quiz ?? {
            pending: {}
        };
        const nextQuizState = this.quizRunner.setPending(currentQuizState, playerId, {
            id: quiz.id ?? `quiz-${playerId}`,
            question,
            answer,
            choices
        });
        const nextMeta = {
            ...metadata,
            quiz: nextQuizState
        };
        const next = {
            ...state,
            metadata: nextMeta
        };
        return this.core.appendLog(next, `Question pour ${this.utils.playerName(state, playerId)}: "${question}"`);
    }
    constructor(deckPool, quizRunner, core, utils, random){
        this.deckPool = deckPool;
        this.quizRunner = quizRunner;
        this.core = core;
        this.utils = utils;
        this.random = random;
    }
};
PanierExpressQuizService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _deckpoolservice.DeckPoolService === "undefined" ? Object : _deckpoolservice.DeckPoolService,
        typeof _quizrunnerservice.QuizRunnerService === "undefined" ? Object : _quizrunnerservice.QuizRunnerService,
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _panierexpressutilsservice.PanierExpressUtils === "undefined" ? Object : _panierexpressutilsservice.PanierExpressUtils,
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], PanierExpressQuizService);
