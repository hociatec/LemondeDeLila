"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PanierExpressBotService = void 0;
const common_1 = require("@nestjs/common");
const bot_runner_service_1 = require("../../../../modules/bot/services/bot-runner.service");
const turn_status_service_1 = require("../../../../modules/turn/services/turn-status.service");
const playing_logger_1 = require("../../../../../common/utils/playing-logger");
const PanierExpressRulebook = __importStar(require("../rulebook/rulebook"));
let PanierExpressBotService = class PanierExpressBotService {
    botRunner;
    turnStatus;
    constructor(botRunner, turnStatus) {
        this.botRunner = botRunner;
        this.turnStatus = turnStatus;
    }
    getBotActions(state, meta, botPlayerId) {
        const current = state.turn?.currentPlayerId ?? null;
        const isBotTurn = current === botPlayerId;
        const profile = meta.botProfile ?? 'greedy';
        const skip = this.turnStatus.getStatus(state, botPlayerId, 'skipTurn');
        if (isBotTurn && skip > 0) {
            (0, playing_logger_1.playingLog)('panier.bot.skip', {
                roomId: state.metadata?.roomId ?? null,
                gameType: state.metadata?.gameType ?? null,
                userId: botPlayerId,
                type: 'skip_turn',
                botPlayerId,
                skip,
            });
            return [{ type: 'skip_turn', payload: { playerId: botPlayerId } }];
        }
        const available = this.injectQuizAnswer(PanierExpressRulebook.getAvailableActions(state, botPlayerId), meta, botPlayerId);
        if (available.length === 0)
            return [];
        const rawPlayer = (state.players ?? []).find((p) => p.id === botPlayerId);
        const shoppingListRaw = rawPlayer?.shoppingList;
        const basketRaw = rawPlayer?.basket;
        const shoppingList = Array.isArray(shoppingListRaw) ? shoppingListRaw : [];
        const basket = Array.isArray(basketRaw) ? basketRaw : [];
        if (!Array.isArray(shoppingListRaw) || !Array.isArray(basketRaw)) {
            (0, playing_logger_1.playingLog)('panier.bot.warn', {
                roomId: state.metadata?.roomId ?? null,
                gameType: state.metadata?.gameType ?? null,
                userId: botPlayerId,
                type: 'warn',
                playerId: botPlayerId,
                shoppingListType: typeof shoppingListRaw,
                basketType: typeof basketRaw,
            });
        }
        const missing = new Set(shoppingList.filter((item) => !basket.includes(item)));
        const players = state.players ?? [];
        const playerById = new Map(players.map((p) => [p.id, p]));
        const score = (action) => {
            const type = action.type?.toLowerCase() ?? '';
            if (type === 'answer_quiz')
                return 6;
            if (type === 'pick_choice') {
                const index = typeof action.payload?.index === 'number' ? action.payload.index : 0;
                return 8 - Math.max(0, Math.min(6, index));
            }
            if (type === 'exchange_accept' || type === 'exchange_refuse') {
                const pending = state.pending;
                const offer = pending && pending.type === 'exchange' && pending.step === 'confirm'
                    ? pending
                    : null;
                if (!offer || offer.playerId !== botPlayerId) {
                    return type === 'exchange_refuse' ? 1 : 0;
                }
                const give = String(offer.give ?? '').trim();
                const take = offer.take != null ? String(offer.take).trim() : null;
                const giveNeeded = give.length > 0 && missing.has(give);
                const takeNeeded = take != null && take.length > 0 && missing.has(take);
                const bonusRequested = offer.bonusRequested === true;
                if (bonusRequested) {
                    return type === 'exchange_refuse' ? 9 : -10;
                }
                if (type === 'exchange_accept') {
                    return 5 + (giveNeeded ? 4 : 0) + (takeNeeded ? -4 : 1);
                }
                return 4 + (takeNeeded ? 3 : 0) + (giveNeeded ? -2 : 0);
            }
            if (type === 'exchange_choose_target') {
                const targetId = action.payload?.targetPlayerId;
                if (typeof targetId !== 'number')
                    return 2;
                const target = playerById.get(targetId);
                const inv = Array.isArray(target?.inventory) ? target.inventory : [];
                const useful = inv.filter((c) => missing.has(String(c))).length;
                return 4 + useful * 2 + Math.min(2, inv.length / 3);
            }
            if (type === 'exchange_choose_give') {
                const give = action.payload?.give;
                if (typeof give !== 'string')
                    return 2;
                const cost = missing.has(give) ? -2 : 1;
                return 4 + cost;
            }
            if (type === 'draw')
                return 7;
            if (type === 'roll')
                return 1;
            return 0;
        };
        const chosen = this.botRunner.choose(available, { state, playerId: botPlayerId }, profile, {
            preferTypes: [
                'draw',
                'answer_quiz',
                'pick_choice',
                'exchange_choose_give',
                'exchange_choose_target',
                'roll',
            ],
            fallbackTypes: ['roll'],
            score,
        });
        if (chosen.length === 0 && available.length > 0) {
            return [available[0]];
        }
        if (chosen.length) {
            (0, playing_logger_1.playingLog)('panier.bot.actions', {
                roomId: state.metadata?.roomId ?? null,
                gameType: state.metadata?.gameType ?? null,
                userId: botPlayerId,
                type: 'bot_actions',
                botPlayerId,
                actions: chosen.map((a) => a.type),
            });
        }
        return chosen;
    }
    injectQuizAnswer(actions, meta, playerId) {
        if (!Array.isArray(actions))
            return [];
        const pending = meta.quiz?.pending?.[playerId];
        const choices = Array.isArray(pending?.choices) ? pending?.choices : [];
        if (!pending || !choices.length)
            return actions;
        const answer = choices[0];
        return actions.map((a) => {
            if (!a || (a.type || '').toLowerCase() !== 'answer_quiz')
                return a;
            return { ...a, payload: { ...(a.payload ?? {}), answer } };
        });
    }
};
exports.PanierExpressBotService = PanierExpressBotService;
exports.PanierExpressBotService = PanierExpressBotService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [bot_runner_service_1.BotRunnerService,
        turn_status_service_1.TurnStatusService])
], PanierExpressBotService);
//# sourceMappingURL=panier-express-bot.service.js.map