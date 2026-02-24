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
exports.BandeABananePresenterService = void 0;
const common_1 = require("@nestjs/common");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const Rulebook = __importStar(require("../rulebook/rulebook"));
const game_definition_1 = require("../definitions/game.definition");
const lamalike_presenter_helper_1 = require("../../../../presenters/lamalike-presenter.helper");
let BandeABananePresenterService = class BandeABananePresenterService {
    exposeStateForUser(state, userId) {
        const meta = (state.metadata ?? {});
        const actions = Rulebook.getAvailableActions(state, userId);
        const hand = Array.isArray(meta.hands?.[userId])
            ? [...meta.hands[userId]]
            : [];
        const handCounts = (0, lamalike_presenter_helper_1.summarizeHandCounts)(meta.hands);
        const panels = (0, lamalike_presenter_helper_1.buildLamaLikePanels)({
            hand,
            handCounts,
            discardLabel: 'Troops en jeu',
            tableMessage: `Statut: ${state.status ?? 'en attente'}`,
        });
        return {
            ...state,
            catalog: {
                phases: game_definition_1.BANDE_A_BANANE_GAME.phaseOrder.map((phase) => phase.id),
                victory: null,
            },
            actions: (0, actions_presenter_helper_1.formatPresenterActions)(actions),
            extras: {
                hand,
                hands: meta.hands,
                troops: meta.troops,
                statuses: meta.statuses,
                ui: { panels },
            },
            pending: state.pending ?? null,
        };
    }
};
exports.BandeABananePresenterService = BandeABananePresenterService;
exports.BandeABananePresenterService = BandeABananePresenterService = __decorate([
    (0, common_1.Injectable)()
], BandeABananePresenterService);
//# sourceMappingURL=la-bande-a-banane-presenter.service.js.map