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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NawakPresenterService = void 0;
const common_1 = require("@nestjs/common");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const Rulebook = __importStar(require("../rulebook/rulebook"));
const game_definition_1 = require("../definitions/game.definition");
const lamalike_presenter_helper_1 = require("../../../../presenters/lamalike-presenter.helper");
let NawakPresenterService = class NawakPresenterService {
    exposeStateForUser(state, userId) {
        const meta = (state.metadata ?? {});
        const actions = Rulebook.getAvailableActions(state, userId);
        const hand = Array.isArray(meta.currentChallenge?.answers)
            ? meta.currentChallenge.answers
            : [];
        const panels = (0, lamalike_presenter_helper_1.buildLamaLikePanels)({
            hand,
            discardLabel: 'Défis disponibles',
            scoreLines: Object.entries(meta.scores ?? {}).map(([playerId, value]) => `Joueur ${playerId}: ${value ?? 0}`),
            tableMessage: `Phase : ${meta.roundStage ?? 'en attente'}`,
        });
        return {
            ...state,
            catalog: {
                phases: game_definition_1.NAWAK_GAME.phaseOrder.map((phase) => phase.id),
                victory: null,
            },
            actions: (0, actions_presenter_helper_1.formatPresenterActions)(actions, (action) => this.buildLabel(action, meta, state)),
            extras: {
                hand,
                targetScore: meta.targetScore,
                scores: meta.scores,
                stage: meta.roundStage,
                challenge: meta.currentChallenge,
                submissions: meta.submissions,
                votes: meta.votes,
                lastRound: meta.lastRound ?? null,
                ui: { panels },
            },
            pending: state.pending ?? null,
        };
    }
    buildLabel(action, meta, state) {
        if (action.type === 'choose_answer') {
            const index = Number(action.payload?.answerIndex ?? 0);
            const raw = meta.currentChallenge.answers?.[index] ?? `réponse ${index + 1}`;
            const answer = String(raw)
                .replace(/[\r\n\t]+/g, ' ')
                .replace(/\s{2,}/g, ' ')
                .trim();
            return `Choisir «${answer.length > 0 ? answer : `réponse ${index + 1}`}»`;
        }
        if (action.type === 'vote_answer') {
            const target = Number(action.payload?.targetPlayerId ?? 0);
            return `Voter pour ${(0, player_name_helper_1.resolvePlayerName)(state.players, target)}`;
        }
        return action.type;
    }
};
exports.NawakPresenterService = NawakPresenterService;
exports.NawakPresenterService = NawakPresenterService = __decorate([
    (0, common_1.Injectable)()
], NawakPresenterService);
//# sourceMappingURL=nawak-presenter.service.js.map