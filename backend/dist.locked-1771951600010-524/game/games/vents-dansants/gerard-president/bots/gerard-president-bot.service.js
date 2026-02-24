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
exports.GerardPresidentBotService = void 0;
const common_1 = require("@nestjs/common");
const bot_runner_service_1 = require("../../../../modules/bot/services/bot-runner.service");
const Rulebook = __importStar(require("../rulebook/rulebook"));
let GerardPresidentBotService = class GerardPresidentBotService {
    botRunner;
    constructor(botRunner) {
        this.botRunner = botRunner;
    }
    getBotActions(state, botPlayerId) {
        const actions = Rulebook.getAvailableActions(state, botPlayerId);
        if (!actions.length) {
            return [];
        }
        const meta = (state.metadata ?? {});
        if (meta.roundPhase === 'waiting_theme') {
            return [{ type: 'set_theme' }];
        }
        if (meta.roundPhase === 'collecting_names') {
            const specialAction = this.tryPlaySpecial(meta, actions, botPlayerId);
            if (specialAction) {
                return [specialAction];
            }
            const nameAction = this.tryPlayName(meta, actions, botPlayerId);
            if (nameAction) {
                return [nameAction];
            }
            return [{ type: 'pass', payload: {} }];
        }
        if (meta.roundPhase === 'choosing_winner') {
            const chooseAction = this.tryChooseWinner(meta, actions);
            if (chooseAction) {
                return [chooseAction];
            }
        }
        return this.botRunner.choose(actions, { state, playerId: botPlayerId }, 'random');
    }
    tryPlaySpecial(meta, actions, playerId) {
        const candidate = actions.find((action) => action.type === 'play_special');
        if (!candidate)
            return null;
        const specialHand = meta.specialHands?.[playerId] ?? [];
        if (!specialHand.length)
            return null;
        return { type: 'play_special', payload: { cardId: specialHand[0] } };
    }
    tryPlayName(meta, actions, playerId) {
        const candidate = actions.find((action) => action.type === 'play_name');
        if (!candidate)
            return null;
        const hand = meta.hands?.[playerId] ?? [];
        if (!hand.length)
            return null;
        const locked = meta.lockedName;
        const extra = Math.max(0, meta.extraNamesAllowed?.[playerId] ?? 0);
        const limit = 1 + extra;
        const selection = [];
        for (const name of hand) {
            if (locked && locked === name) {
                continue;
            }
            selection.push(name);
            if (selection.length >= limit) {
                break;
            }
        }
        if (!selection.length) {
            return null;
        }
        return { type: 'play_name', payload: { names: selection } };
    }
    tryChooseWinner(meta, actions) {
        const candidate = actions.find((action) => action.type === 'choose_winner');
        if (!candidate)
            return null;
        const submissions = meta.submissions ?? {};
        const ids = Object.keys(submissions)
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value));
        if (!ids.length)
            return null;
        const winnerId = ids[Math.floor(Math.random() * ids.length)];
        return { type: 'choose_winner', payload: { winnerId } };
    }
};
exports.GerardPresidentBotService = GerardPresidentBotService;
exports.GerardPresidentBotService = GerardPresidentBotService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [bot_runner_service_1.BotRunnerService])
], GerardPresidentBotService);
//# sourceMappingURL=gerard-president-bot.service.js.map