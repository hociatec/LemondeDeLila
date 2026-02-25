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
exports.DameNaturePresenterService = void 0;
const common_1 = require("@nestjs/common");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const Rulebook = __importStar(require("../rulebook/rulebook"));
const game_definition_1 = require("../definitions/game.definition");
const dame_nature_cards_1 = require("../model/dame-nature-cards");
const lamalike_presenter_helper_1 = require("../../../../presenters/lamalike-presenter.helper");
let DameNaturePresenterService = class DameNaturePresenterService {
    exposeStateForUser(state, userId) {
        const meta = (state.metadata ?? {});
        const actions = Rulebook.getAvailableActions(state, userId);
        const deckCount = Array.isArray(meta.deck) ? meta.deck.length : 0;
        const pollution = meta.pollutionTokens ?? 0;
        const hand = Array.isArray(meta.hands?.[userId])
            ? [...meta.hands[userId]]
            : [];
        const handCounts = (0, lamalike_presenter_helper_1.summarizeHandCounts)(meta.hands);
        const panels = (0, lamalike_presenter_helper_1.buildLamaLikePanels)({
            hand,
            handCounts,
            discardLabel: 'Famille ciblée',
            tableMessage: `Pollution : ${pollution}`,
        });
        return {
            ...state,
            catalog: {
                phases: game_definition_1.DAME_NATURE_GAME.phaseOrder.map((phase) => phase.id),
                victory: null,
            },
            actions: (0, actions_presenter_helper_1.formatPresenterActions)(actions),
            extras: {
                hand,
                handCards: this.buildHandCards(hand),
                catalog: this.buildCatalog(),
                playerViews: this.buildPlayerViews(state.players),
                hands: meta.hands,
                families: meta.families,
                pollutionTokens: pollution,
                deckCount,
                lastQuizCardId: meta.lastQuizCardId ?? null,
                pollutionLoserId: meta.pollutionLoserId ?? null,
                ui: { panels },
            },
            pending: state.pending ?? null,
        };
    }
    buildCatalog() {
        const catalog = {};
        for (const card of dame_nature_cards_1.DAME_NATURE_FAMILY_CARD_DEFINITIONS) {
            const key = card.familyId;
            const list = catalog[key] ?? [];
            list.push({
                id: card.id,
                name: `${card.familyName} - ${card.memberName}`,
            });
            catalog[key] = list;
        }
        return catalog;
    }
    buildHandCards(hand) {
        const cards = [];
        for (const cardId of hand ?? []) {
            const definition = dame_nature_cards_1.DAME_NATURE_CARD_BY_ID[cardId];
            if (!definition) {
                continue;
            }
            if (definition.type === 'family') {
                cards.push({
                    familyId: definition.familyId,
                    memberId: definition.id,
                    label: `${definition.familyName} - ${definition.memberName}`,
                });
                continue;
            }
            const label = definition.type === 'quiz'
                ? definition.question
                : definition.description;
            cards.push({
                familyId: undefined,
                memberId: definition.id,
                label,
            });
        }
        return cards;
    }
    buildPlayerViews(players) {
        if (!Array.isArray(players))
            return [];
        return players
            .filter((player) => typeof player?.id === 'number')
            .map((player) => ({
            id: player.id,
            username: player.username?.trim() || `Joueur ${player.id}`,
        }));
    }
};
exports.DameNaturePresenterService = DameNaturePresenterService;
exports.DameNaturePresenterService = DameNaturePresenterService = __decorate([
    (0, common_1.Injectable)()
], DameNaturePresenterService);
//# sourceMappingURL=dame-nature-presenter.service.js.map