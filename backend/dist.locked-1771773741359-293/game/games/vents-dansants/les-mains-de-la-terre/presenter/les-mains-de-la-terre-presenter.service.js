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
exports.LesMainsPresenterService = void 0;
const common_1 = require("@nestjs/common");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const Rulebook = __importStar(require("../rulebook/rulebook"));
const les_mains_de_la_terre_cards_1 = require("../model/les-mains-de-la-terre-cards");
const game_definition_1 = require("../definitions/game.definition");
const lamalike_presenter_helper_1 = require("../../../../presenters/lamalike-presenter.helper");
const string_value_utils_1 = require("../../../../../common/utils/string-value.utils");
const FAMILY_LABELS = {
    tradition: 'Tradition',
    nature: 'Nature',
    mer: 'Mer',
    art: 'Art',
    insolites: 'Insolites',
    innovation: 'Innovation',
    sante: 'Santé',
};
let LesMainsPresenterService = class LesMainsPresenterService {
    exposeStateForUser(state, userId) {
        const meta = (state.metadata ?? {});
        const actions = Rulebook.getAvailableActions(state, userId);
        const hand = Array.isArray(meta.hands?.[userId]) ? meta.hands[userId] : [];
        const handCounts = (0, lamalike_presenter_helper_1.summarizeHandCounts)(meta.hands);
        const panels = (0, lamalike_presenter_helper_1.buildLamaLikePanels)({
            hand,
            handCounts,
            discardLabel: 'Table de métiers',
            tableMessage: `Statut: ${state.status ?? 'en attente'}`,
        });
        const familyCatalog = this.buildFamilyCatalog();
        const catalog = {
            phases: game_definition_1.LES_MAINS_GAME.phaseOrder.map((phase) => phase.id),
            victory: null,
            ...familyCatalog,
        };
        return {
            ...state,
            catalog,
            actions: (0, actions_presenter_helper_1.formatPresenterActions)(actions, (action) => this.buildLabel(action)),
            extras: {
                hand,
                handCards: this.buildHandCards(hand),
                catalog,
                deckCount: meta.deck?.length ?? 0,
                completedFamilies: meta.completedFamilies,
                freeRequest: Boolean(meta.freeFamilyRequest?.[userId]),
                statuses: meta.statuses,
                playerViews: this.buildPlayerViews(state.players),
                ui: { panels },
            },
            pending: state.pending ?? null,
        };
    }
    buildLabel(action) {
        if (action.type === 'request_card') {
            const cardId = (0, string_value_utils_1.stringOrEmpty)(action.payload?.cardId);
            return `Demander ${les_mains_de_la_terre_cards_1.LES_MAINS_CARD_BY_ID[cardId]?.name ?? cardId}`;
        }
        return action.type;
    }
    buildFamilyCatalog() {
        const catalog = {};
        const cards = Object.values(les_mains_de_la_terre_cards_1.LES_MAINS_CARD_BY_ID);
        for (const family of les_mains_de_la_terre_cards_1.LES_MAINS_FAMILIES) {
            const members = cards
                .filter((card) => card.family === family)
                .map((card) => ({
                id: card.id,
                name: `${FAMILY_LABELS[family] ?? family} - ${card.name}`,
            }));
            if (members.length) {
                catalog[family] = members;
            }
        }
        return catalog;
    }
    buildHandCards(hand) {
        const cards = hand.map((cardId) => {
            const card = les_mains_de_la_terre_cards_1.LES_MAINS_CARD_BY_ID[cardId];
            if (!card) {
                return null;
            }
            const familyId = card.family ?? undefined;
            const familyLabel = (familyId && FAMILY_LABELS[familyId]) || (familyId ?? 'Carte');
            const label = card.name ? `${familyLabel} - ${card.name}` : cardId;
            return {
                familyId,
                memberId: card.id,
                label,
            };
        });
        return cards.filter((entry) => entry !== null);
    }
    buildPlayerViews(players) {
        if (!Array.isArray(players))
            return [];
        return players
            .map((player) => {
            if (!player?.id)
                return null;
            const username = typeof player.username === 'string' &&
                player.username.trim().length > 0
                ? player.username.trim()
                : `Joueur ${player.id}`;
            return { id: player.id, username };
        })
            .filter((view) => view != null);
    }
};
exports.LesMainsPresenterService = LesMainsPresenterService;
exports.LesMainsPresenterService = LesMainsPresenterService = __decorate([
    (0, common_1.Injectable)()
], LesMainsPresenterService);
//# sourceMappingURL=les-mains-de-la-terre-presenter.service.js.map