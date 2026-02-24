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
exports.CatPattesPresenterService = void 0;
const common_1 = require("@nestjs/common");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const Rulebook = __importStar(require("../rulebook/rulebook"));
const game_definition_1 = require("../definitions/game.definition");
const cat_pattes_cards_1 = require("../model/cat-pattes-cards");
const cat_pattes_state_entity_1 = require("../model/cat-pattes-state.entity");
const string_value_utils_1 = require("../../../../../common/utils/string-value.utils");
let CatPattesPresenterService = class CatPattesPresenterService {
    exposeStateForUser(state, userId) {
        const meta = (state.metadata ?? {});
        const actions = Rulebook.getAvailableActions(state, userId);
        const pending = this.normalizePending(state.pending, actions);
        const handIds = Array.isArray(meta.hands?.[userId])
            ? [...meta.hands[userId]]
            : [];
        const hand = handIds.map((id) => cat_pattes_cards_1.CAT_PATTES_CARD_BY_ID[id]?.name ?? id);
        const players = Array.isArray(state.players) ? state.players : [];
        const nameById = {};
        for (const p of players) {
            if (!p?.id)
                continue;
            nameById[p.id] =
                p?.username && String(p.username).trim()
                    ? String(p.username).trim()
                    : `Joueur ${p.id}`;
        }
        const scoreLines = players.map((p) => {
            const pid = p?.id;
            const name = nameById[pid] ?? `Joueur ${pid}`;
            const points = Number(meta.points?.[pid] ?? 0);
            return `${name} : ${points} points.`;
        });
        const progressionLines = players.map((p) => {
            const pid = p?.id;
            const name = nameById[pid] ?? `Joueur ${pid}`;
            const value = Number(meta.positions?.[pid] ?? 0);
            return `${name} : ${value} pattes / ${cat_pattes_state_entity_1.CAT_PATTES_GOAL}.`;
        });
        const handCounts = Object.entries(meta.hands ?? {})
            .map(([id, cards]) => `Joueur ${id}: ${Array.isArray(cards) ? cards.length : 0}`)
            .join(' • ');
        const extras = {
            hand,
            handIds,
            hands: meta.hands,
            positions: meta.positions,
            points: meta.points,
            obstacles: meta.obstacles,
            bots: meta.bots,
            hasSun: meta.hasSun,
            pawns: meta.pawns,
            pawnByPlayerId: meta.pawnByPlayerId,
            ui: {
                panels: {
                    hand: {
                        title: 'Main',
                        message: hand.length
                            ? `Main : ${hand.join(', ')}`
                            : 'Main : (vide)',
                    },
                    hands: {
                        title: 'Mains',
                        message: handCounts
                            ? `Mains : ${handCounts}`
                            : 'Mains : (inconnues)',
                    },
                    play: {
                        title: 'À jouer',
                        message: '(↑/↓ choisir, Entrée jouer, Espace piocher, C défausser, S score, P progression)',
                    },
                    score: {
                        title: 'Score',
                        message: scoreLines.join(' '),
                    },
                    position: {
                        title: 'Progression',
                        message: progressionLines.join(' '),
                    },
                },
            },
        };
        return {
            ...state,
            catalog: {
                phases: game_definition_1.CAT_PATTES_GAME.phaseOrder.map((phase) => phase.id),
                victory: null,
            },
            actions: (0, actions_presenter_helper_1.formatPresenterActions)(actions),
            extras,
            pending,
        };
    }
    normalizePending(pending, actions) {
        if (!pending || typeof pending !== 'object')
            return pending ?? null;
        const type = String(pending?.type ?? '')
            .trim()
            .toLowerCase();
        if (type !== 'choose_pawn')
            return pending;
        const rawChoices = Array.isArray(pending?.choices) ? pending.choices : [];
        const normalizedChoices = rawChoices
            .map((choice) => (0, string_value_utils_1.stringOrEmpty)(choice).trim())
            .filter((choice) => choice.length > 0);
        if (normalizedChoices.length > 0) {
            return {
                ...pending,
                choices: normalizedChoices,
            };
        }
        const pendingPawns = Array.isArray(pending?.data?.pawns)
            ? pending.data.pawns
            : [];
        const pawnsFromPendingData = pendingPawns
            .map((pawn) => (0, string_value_utils_1.stringOrEmpty)(pawn?.label ?? pawn?.id ?? '').trim())
            .filter((choice) => choice.length > 0);
        if (pawnsFromPendingData.length > 0) {
            return {
                ...pending,
                choices: pawnsFromPendingData,
            };
        }
        const pawnsFromActions = (Array.isArray(actions) ? actions : [])
            .filter((action) => String(action?.type ?? '')
            .trim()
            .toLowerCase() === 'choose_pawn')
            .map((action) => {
            const payload = action?.payload ?? {};
            return (0, string_value_utils_1.stringOrEmpty)(payload.pawnId ?? payload.pawn ?? payload.value).trim();
        })
            .filter((choice) => choice.length > 0);
        if (pawnsFromActions.length > 0) {
            return {
                ...pending,
                choices: pawnsFromActions,
            };
        }
        return pending;
    }
};
exports.CatPattesPresenterService = CatPattesPresenterService;
exports.CatPattesPresenterService = CatPattesPresenterService = __decorate([
    (0, common_1.Injectable)()
], CatPattesPresenterService);
//# sourceMappingURL=cat-pattes-presenter.service.js.map