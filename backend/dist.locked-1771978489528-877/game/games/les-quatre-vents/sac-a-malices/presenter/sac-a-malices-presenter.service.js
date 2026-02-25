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
exports.SacAMalicesPresenterService = void 0;
const common_1 = require("@nestjs/common");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const board_payload_service_1 = require("../../../../modules/board/services/board-payload.service");
const sac_a_malices_definition_1 = require("../definitions/sac-a-malices.definition");
const Rulebook = __importStar(require("../rulebook/rulebook"));
const sac_a_malices_variants_1 = require("../sac-a-malices-variants");
let SacAMalicesPresenterService = class SacAMalicesPresenterService {
    boardPayload;
    constructor(boardPayload) {
        this.boardPayload = boardPayload;
    }
    exposeStateForUser(state, userId) {
        const actions = Rulebook.getAvailableActions(state, userId);
        const meta = (state.metadata ?? {});
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p) => p?.id === userId);
        const money = meta.money?.[userId] ?? 0;
        const pending = this.buildVariantPrompt(meta, players, userId) ?? state.pending ?? null;
        const propertyPanels = this.buildPropertyPanels(meta, players, userId);
        const stateRecord = state;
        const extrasBase = stateRecord.extras && typeof stateRecord.extras === 'object'
            ? stateRecord.extras
            : {};
        return {
            ...state,
            catalog: {
                phases: sac_a_malices_definition_1.SAC_A_MALICES_GAME.phaseOrder.map((p) => p.id),
                victory: null,
            },
            actions: (0, actions_presenter_helper_1.formatPresenterActions)(actions),
            pending,
            extras: {
                ...extrasBase,
                currentPlayerView: {
                    id: userId,
                    username: me?.username ?? `Joueur ${userId}`,
                },
                ui: {
                    panels: {
                        position: {
                            title: 'Position',
                            message: this.boardPayload.buildPositionPanelMessage({
                                tilesRaw: meta.tiles,
                                positionsRaw: meta.positions,
                                playerId: userId,
                            }),
                        },
                        cash: {
                            title: 'Caisse',
                            message: `${money} €`,
                        },
                        parcGratuit: {
                            title: 'Parc Gratuit',
                            message: `Pot: ${meta.pot ?? 0} €`,
                        },
                        properties_all: {
                            title: 'Propriétés',
                            message: propertyPanels.all,
                        },
                        properties_mine: {
                            title: 'Mes propriétés',
                            message: propertyPanels.mine,
                        },
                        properties_others: {
                            title: 'Propriétés des autres',
                            message: propertyPanels.others,
                        },
                        properties_available: {
                            title: 'Propriétés disponibles',
                            message: propertyPanels.available,
                        },
                    },
                },
            },
            board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions),
        };
    }
    buildVariantPrompt(meta, players, userId) {
        if ((meta.setupStep ?? '') !== 'setup_config')
            return null;
        const metadataRecord = meta;
        const rawOwnerId = metadataRecord.ownerPlayerId;
        const ownerId = typeof rawOwnerId === 'number' ? rawOwnerId : (players[0]?.id ?? null);
        if (ownerId == null || ownerId !== userId)
            return null;
        const choices = sac_a_malices_variants_1.SAC_VARIANTS.map((variant) => variant.label).filter((label) => label && label.trim());
        if (choices.length === 0) {
            return null;
        }
        return {
            type: 'sac_setup_variant',
            playerId: ownerId,
            label: 'Choisissez votre Monopoly',
            blocking: true,
            choices,
        };
    }
    buildPropertyPanels(meta, players, userId) {
        const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
        const ownership = meta.ownership ?? {};
        const nameById = new Map(players
            .filter((p) => typeof p?.id === 'number')
            .map((p) => [
            p.id,
            typeof p?.username === 'string' && p.username.trim().length > 0
                ? p.username.trim()
                : `Joueur ${p.id}`,
        ]));
        const ownable = tiles
            .map((tile, idx) => ({ tile, idx }))
            .filter(({ tile }) => ['property', 'station', 'utility'].includes(String(tile?.type ?? '')));
        const formatTile = (_idx, title, ownerId) => {
            if (ownerId == null)
                return `${title} (libre)`;
            const ownerName = nameById.get(ownerId) ?? `Joueur ${ownerId}`;
            return `${title} (${ownerName})`;
        };
        const all = ownable.map(({ tile, idx }) => formatTile(idx, tile.title ?? `Case ${idx + 1}`, ownership[idx] ?? null));
        const mine = ownable
            .filter(({ idx }) => ownership[idx] === userId)
            .map(({ tile, idx }) => formatTile(idx, tile.title ?? `Case ${idx + 1}`, userId));
        const others = ownable
            .filter(({ idx }) => ownership[idx] != null && ownership[idx] !== userId)
            .map(({ tile, idx }) => formatTile(idx, tile.title ?? `Case ${idx + 1}`, ownership[idx]));
        const available = ownable
            .filter(({ idx }) => ownership[idx] == null)
            .map(({ tile, idx }) => formatTile(idx, tile.title ?? `Case ${idx + 1}`, null));
        return {
            all: all.length ? all.join('\n') : 'Aucune propriété.',
            mine: mine.length ? mine.join('\n') : 'Aucune propriété.',
            others: others.length ? others.join('\n') : 'Aucune propriété.',
            available: available.length ? available.join('\n') : 'Aucune propriété.',
        };
    }
};
exports.SacAMalicesPresenterService = SacAMalicesPresenterService;
exports.SacAMalicesPresenterService = SacAMalicesPresenterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [board_payload_service_1.BoardPayloadService])
], SacAMalicesPresenterService);
//# sourceMappingURL=sac-a-malices-presenter.service.js.map