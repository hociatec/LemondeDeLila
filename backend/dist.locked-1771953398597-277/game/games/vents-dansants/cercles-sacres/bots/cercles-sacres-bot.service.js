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
exports.CerclesSacresBotService = void 0;
const common_1 = require("@nestjs/common");
const bot_runner_service_1 = require("../../../../modules/bot/services/bot-runner.service");
const Rulebook = __importStar(require("../rulebook/rulebook"));
const cercles_sacres_cards_1 = require("../model/cercles-sacres-cards");
const CIRCLE_THEMES = [
    'totem',
    'nature',
    'plante',
    'esprit',
    'parole',
    'nation',
];
let CerclesSacresBotService = class CerclesSacresBotService {
    botRunner;
    constructor(botRunner) {
        this.botRunner = botRunner;
    }
    getBotActions(state, botPlayerId) {
        const actions = Rulebook.getAvailableActions(state, botPlayerId);
        if (!actions.length)
            return [];
        const circleAction = actions.find((action) => action.type === 'form_circle');
        if (circleAction) {
            const combo = this.buildCircle(state, botPlayerId);
            if (combo.length === CIRCLE_THEMES.length) {
                return [{ type: 'form_circle', payload: { cardIds: combo } }];
            }
        }
        return this.botRunner.choose(actions, { state, playerId: botPlayerId }, 'greedy', {
            preferTypes: ['form_circle', 'discard_card'],
            fallbackTypes: ['discard_card', 'pass'],
        });
    }
    buildCircle(state, playerId) {
        const meta = (state.metadata ?? {});
        const hand = Array.isArray(meta.hands?.[playerId])
            ? meta.hands[playerId]
            : [];
        const cardsByTheme = new Map();
        for (const cardId of hand) {
            const definition = cercles_sacres_cards_1.CERCLES_SACRES_CARD_BY_ID[cardId];
            if (!definition)
                continue;
            const list = cardsByTheme.get(definition.theme) ?? [];
            list.push(cardId);
            cardsByTheme.set(definition.theme, list);
        }
        const combo = [];
        for (const theme of CIRCLE_THEMES) {
            const choices = cardsByTheme.get(theme);
            if (!choices?.length) {
                return [];
            }
            combo.push(choices[Math.floor(Math.random() * choices.length)]);
        }
        return combo;
    }
};
exports.CerclesSacresBotService = CerclesSacresBotService;
exports.CerclesSacresBotService = CerclesSacresBotService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [bot_runner_service_1.BotRunnerService])
], CerclesSacresBotService);
//# sourceMappingURL=cercles-sacres-bot.service.js.map