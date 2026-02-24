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
exports.ZigEtZagPresenterService = void 0;
const common_1 = require("@nestjs/common");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const Rulebook = __importStar(require("../rulebook/rulebook"));
const game_definition_1 = require("../definitions/game.definition");
const zig_et_zag_cards_1 = require("../model/zig-et-zag-cards");
const lamalike_presenter_helper_1 = require("../../../../presenters/lamalike-presenter.helper");
let ZigEtZagPresenterService = class ZigEtZagPresenterService {
    exposeStateForUser(state, userId) {
        const meta = (state.metadata ?? {});
        const deckCounts = {};
        const initialDeckCounts = meta.initialDeckCounts ?? {};
        const handCounts = (0, lamalike_presenter_helper_1.summarizeHandCounts)(meta.playerDecks);
        const panels = (0, lamalike_presenter_helper_1.buildLamaLikePanels)({
            hand: [],
            handCounts,
            discardLabel: 'Paquet',
            playMessage: 'Main : (cachée). Espace piocher.',
            tableMessage: `Statut: ${state.status ?? 'en attente'}`,
        });
        Object.entries(meta.playerDecks ?? {}).forEach(([key, cards]) => {
            const pid = Number(key);
            deckCounts[pid] = Array.isArray(cards) ? cards.length : 0;
        });
        const playerList = Array.isArray(state.players) ? state.players : [];
        const deckSummary = playerList
            .map((player) => {
            const pid = Number(player?.id);
            if (!Number.isFinite(pid))
                return null;
            const name = String(player?.username ?? `Joueur ${pid}`).trim() || `Joueur ${pid}`;
            const current = deckCounts[pid] ?? 0;
            const base = initialDeckCounts[pid] ?? current;
            return `${name}: ${current}/${base}`;
        })
            .filter((line) => Boolean(line));
        panels.decks = {
            title: 'Cartes',
            message: deckSummary.length
                ? deckSummary.join('. ')
                : 'Aucune carte distribuee.',
        };
        const stage = meta.roundState?.stage ?? 'selection';
        const waitingPlayers = meta.roundState?.waitingPlayers ?? [];
        const handRows = [];
        const actions = Rulebook.getAvailableActions(state, userId);
        return {
            ...state,
            catalog: {
                phases: game_definition_1.ZIG_ET_ZAG_GAME.phaseOrder.map((phase) => phase.id),
                victory: null,
            },
            actions: (0, actions_presenter_helper_1.formatPresenterActions)(actions, (action) => this.actionLabel(action)),
            extras: {
                hand: handRows,
                stage,
                waitingPlayers,
                deckCounts,
                lastRound: meta.lastRound ?? null,
                ui: { panels },
            },
            pending: state.pending ?? null,
        };
    }
    actionLabel(action) {
        const type = String(action.type ?? '').toLowerCase();
        if (type === 'draw_card') {
            return 'Piocher une carte';
        }
        if (type === 'select_card') {
            const cardId = String(action.payload?.cardId ?? '').trim();
            const definition = zig_et_zag_cards_1.ZIG_ET_ZAG_CARD_BY_ID[cardId];
            return `Jouer ${definition?.name ?? 'une carte'}`;
        }
        return 'Jouer une carte';
    }
};
exports.ZigEtZagPresenterService = ZigEtZagPresenterService;
exports.ZigEtZagPresenterService = ZigEtZagPresenterService = __decorate([
    (0, common_1.Injectable)()
], ZigEtZagPresenterService);
//# sourceMappingURL=zig-et-zag-presenter.service.js.map