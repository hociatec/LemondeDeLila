"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotStrategyService = void 0;
const common_1 = require("@nestjs/common");
let BotStrategyService = class BotStrategyService {
    choose(actions, ctx, opts = {}) {
        if (!Array.isArray(actions) || actions.length === 0)
            return [];
        const { score } = opts;
        const prefer = (opts.preferTypes ?? []).map((t) => t.toLowerCase());
        const fallbacks = (opts.fallbackTypes ?? []).map((t) => t.toLowerCase());
        if (score) {
            let bestScore = -Infinity;
            const best = [];
            for (const action of actions) {
                const s = score(action, ctx);
                if (s > bestScore + Number.EPSILON) {
                    bestScore = s;
                    best.length = 0;
                    best.push(action);
                    continue;
                }
                if (Math.abs(s - bestScore) <= Number.EPSILON) {
                    best.push(action);
                }
            }
            if (best.length === 0)
                return [];
            if (best.length === 1)
                return [best[0]];
            const pick = best[Math.floor(Math.random() * best.length)];
            return pick ? [pick] : [];
        }
        for (const type of prefer) {
            const found = actions.find((a) => a.type?.toLowerCase() === type);
            if (found)
                return [found];
        }
        for (const type of fallbacks) {
            const found = actions.find((a) => a.type?.toLowerCase() === type);
            if (found)
                return [found];
        }
        const pick = actions[Math.floor(Math.random() * actions.length)];
        return pick ? [pick] : [];
    }
    chooseProfile(actions, ctx, profile = 'random', opts = {}) {
        const scoreFn = opts.score ??
            ((action) => {
                if (profile === 'random')
                    return Math.random();
                const weights = {
                    greedy: {
                        ask_card: 6,
                        draw: 4,
                        exchange_with: 5,
                        exchange: 4,
                        answer_quiz: 5,
                        roll: 1,
                    },
                    cautious: {
                        draw: 5,
                        answer_quiz: 4,
                        ask_card: 3,
                        exchange_with: 2,
                        exchange: 2,
                        roll: 1,
                    },
                    aggressive: {
                        ask_card: 7,
                        exchange_with: 6,
                        exchange: 5,
                        draw: 3,
                        answer_quiz: 4,
                        roll: 1,
                    },
                    random: {},
                };
                const type = (action.type ?? '').toLowerCase();
                const table = weights[profile] ?? {};
                const base = table[type] ?? 0;
                const quizBonus = type.includes('quiz') &&
                    (action.payload?.correct === true || action.payload?.answer)
                    ? 1
                    : 0;
                return base + quizBonus;
            });
        return this.choose(actions, ctx, { ...opts, score: scoreFn });
    }
};
exports.BotStrategyService = BotStrategyService;
exports.BotStrategyService = BotStrategyService = __decorate([
    (0, common_1.Injectable)()
], BotStrategyService);
//# sourceMappingURL=bot-strategy.service.js.map