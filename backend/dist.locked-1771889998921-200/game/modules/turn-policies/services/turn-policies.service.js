"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurnPoliciesService = void 0;
const common_1 = require("@nestjs/common");
const game_core_service_1 = require("../../../core/services/game-core.service");
const game_log_text_helper_1 = require("../../../core/helpers/game-log-text.helper");
const string_value_utils_1 = require("../../../../common/utils/string-value.utils");
let TurnPoliciesService = class TurnPoliciesService {
    core;
    constructor(core) {
        this.core = core;
    }
    sanitizePlayerName(raw) {
        let name = (0, string_value_utils_1.stringOrEmpty)(raw).trim();
        name = name
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        if (name.startsWith('"') && name.endsWith('"')) {
            name = name.slice(1, -1).trim();
        }
        const lowered = name.toLowerCase();
        if (lowered.endsWith('(zone de jeu)') ||
            lowered.endsWith('(zone de jeux)') ||
            lowered.endsWith('(game zone)')) {
            const openParen = name.lastIndexOf('(');
            if (openParen > 0) {
                name = name.slice(0, openParen).trimEnd();
            }
        }
        return name;
    }
    playerName(state, playerId) {
        const players = Array.isArray(state.players) ? state.players : [];
        const player = players.find((p) => {
            const id = Number(p?.id);
            return Number.isFinite(id)
                ? id === playerId
                : p?.id === playerId;
        });
        const username = this.sanitizePlayerName(player?.username);
        return username.length > 0 ? username : `Joueur ${playerId}`;
    }
    appendTurnAnnouncement(state, playerId, playerNameResolver) {
        if (typeof playerId !== 'number' || !Number.isFinite(playerId))
            return state;
        const label = typeof playerNameResolver === 'function'
            ? playerNameResolver(state, playerId)
            : this.playerName(state, playerId);
        return this.core.appendLog(state, (0, game_log_text_helper_1.turnAnnouncement)(label));
    }
};
exports.TurnPoliciesService = TurnPoliciesService;
exports.TurnPoliciesService = TurnPoliciesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_core_service_1.GameCoreService])
], TurnPoliciesService);
//# sourceMappingURL=turn-policies.service.js.map