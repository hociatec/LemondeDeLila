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
exports.GerardPresidentPresenterService = void 0;
const common_1 = require("@nestjs/common");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const Rulebook = __importStar(require("../rulebook/rulebook"));
const gerard_president_cards_1 = require("../model/gerard-president-cards");
const lamalike_presenter_helper_1 = require("../../../../presenters/lamalike-presenter.helper");
const ACTION_LABELS = {
    set_theme: 'Définir un thème',
    play_name: 'Jouer un prénom',
    play_special: 'Jouer une carte spéciale',
    pass: 'Passer',
    choose_winner: 'Choisir le gagnant',
};
let GerardPresidentPresenterService = class GerardPresidentPresenterService {
    exposeStateForUser(state, userId) {
        const metadata = (state.metadata ?? {});
        const submissions = metadata.submissions ?? {};
        const sanitizedSubmissions = this.sanitizeSubmissions(submissions, userId);
        const hand = metadata.hands?.[userId] ?? [];
        const specialHand = metadata.specialHands?.[userId] ?? [];
        const handCounts = this.buildHandCounts(metadata.hands);
        const isMaster = metadata.masterId === userId;
        const themeHidden = metadata.themeSecretActive && metadata.masterId != null && !isMaster;
        const currentTheme = themeHidden ? 'Thème secret' : metadata.currentTheme;
        const secondTheme = themeHidden && metadata.secondTheme
            ? 'Thème secret'
            : metadata.secondTheme;
        const actions = Rulebook.getAvailableActions(state, userId);
        const catalog = this.buildCatalog();
        const scoreLines = Object.entries(metadata.scores ?? {}).map(([pid, value]) => ({
            pid: Number(pid),
            value,
        }));
        const panels = (0, lamalike_presenter_helper_1.buildLamaLikePanels)({
            hand,
            handCounts,
            discardLabel: 'Soumissions',
            scoreLines: scoreLines.map((entry) => {
                const playerName = (0, player_name_helper_1.resolvePlayerName)(state.players, entry.pid);
                return `${playerName}: ${entry.value ?? 0}`;
            }),
            tableMessage: `Phase : ${metadata.roundPhase ?? 'en attente'}`,
        });
        const extras = {
            hand,
            specialHand,
            handCards: this.buildHandCards(hand, specialHand),
            handCounts,
            playerViews: this.buildPlayerViews(state.players),
            submissions: metadata.juryOverrideId
                ? this.markJuryOverride(sanitizedSubmissions, metadata.juryOverrideId)
                : sanitizedSubmissions,
            scores: metadata.scores,
            roundPhase: metadata.roundPhase,
            targetScore: metadata.targetScore,
            pendingPlayers: metadata.pendingPlayers,
            ui: { panels },
        };
        return {
            ...state,
            metadata: {
                ...metadata,
                currentTheme,
                secondTheme,
                hands: { [userId]: [...hand] },
                specialHands: { [userId]: [...specialHand] },
                submissions: sanitizedSubmissions,
            },
            catalog,
            actions: (0, actions_presenter_helper_1.formatPresenterActions)(actions, (action) => ACTION_LABELS[action.type] ?? action.type),
            extras,
            pending: state.pending ?? null,
        };
    }
    sanitizeSubmissions(submissions, viewerId) {
        const sanitized = {};
        Object.entries(submissions).forEach(([key, names]) => {
            const playerId = Number(key);
            if (playerId === viewerId) {
                sanitized[playerId] = [...(names ?? [])];
            }
            else {
                sanitized[playerId] = (names ?? []).map(() => 'Prénom secret');
            }
        });
        return sanitized;
    }
    markJuryOverride(submissions, juryId) {
        if (!submissions[juryId]) {
            return submissions;
        }
        return {
            ...submissions,
            [juryId]: submissions[juryId].map((name) => `${name} (jury)`),
        };
    }
    buildHandCounts(hands) {
        const counts = {};
        Object.entries(hands ?? {}).forEach(([key, values]) => {
            const playerId = Number(key);
            if (!Number.isFinite(playerId))
                return;
            counts[playerId] = Array.isArray(values) ? values.length : 0;
        });
        return counts;
    }
    buildCatalog() {
        return {
            phases: ['round'],
            victory: null,
            names: gerard_president_cards_1.GERARD_PRESIDENT_NAMES.map((name, index) => ({
                id: `name-${index}`,
                name,
            })),
            specials: gerard_president_cards_1.GERARD_PRESIDENT_SPECIAL_CARDS.map((card) => ({
                id: card.id,
                name: card.name,
                label: card.description,
            })),
            themes: gerard_president_cards_1.GERARD_PRESIDENT_THEMES.map((theme, index) => ({
                id: `theme-${index}`,
                name: theme,
            })),
        };
    }
    buildHandCards(hand, specialHand) {
        const cards = [
            ...hand.map((card) => ({
                familyId: 'name',
                memberId: card,
                label: card,
            })),
            ...specialHand.map((cardId) => {
                const special = gerard_president_cards_1.GERARD_PRESIDENT_SPECIAL_CARDS.find((card) => card.id === cardId);
                const label = special
                    ? `${special.name} – ${special.description}`
                    : cardId;
                return { familyId: 'special', memberId: cardId, label };
            }),
        ];
        return cards;
    }
    buildPlayerViews(players) {
        if (!Array.isArray(players))
            return [];
        return players
            .filter((player) => typeof player?.id === 'number')
            .map((player) => ({
            id: player.id,
            username: player?.username?.trim() || `Joueur ${player.id}`,
        }));
    }
};
exports.GerardPresidentPresenterService = GerardPresidentPresenterService;
exports.GerardPresidentPresenterService = GerardPresidentPresenterService = __decorate([
    (0, common_1.Injectable)()
], GerardPresidentPresenterService);
//# sourceMappingURL=gerard-president-presenter.service.js.map