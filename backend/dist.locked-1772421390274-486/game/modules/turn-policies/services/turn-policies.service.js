"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TurnPoliciesService", {
    enumerable: true,
    get: function() {
        return TurnPoliciesService;
    }
});
const _common = require("@nestjs/common");
const _gamecoreservice = require("../../../core/services/game-core.service");
const _gamelogtexthelper = require("../../../core/helpers/game-log-text.helper");
const _stringvalueutils = require("../../../../common/utils/string-value.utils");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let TurnPoliciesService = class TurnPoliciesService {
    sanitizePlayerName(raw) {
        let name = (0, _stringvalueutils.stringOrEmpty)(raw).trim();
        name = name.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (name.startsWith('"') && name.endsWith('"')) {
            name = name.slice(1, -1).trim();
        }
        const lowered = name.toLowerCase();
        if (lowered.endsWith('(zone de jeu)') || lowered.endsWith('(zone de jeux)') || lowered.endsWith('(game zone)')) {
            const openParen = name.lastIndexOf('(');
            if (openParen > 0) {
                name = name.slice(0, openParen).trimEnd();
            }
        }
        return name;
    }
    playerName(state, playerId) {
        const players = Array.isArray(state.players) ? state.players : [];
        const player = players.find((p)=>{
            const id = Number(p?.id);
            return Number.isFinite(id) ? id === playerId : p?.id === playerId;
        });
        const username = this.sanitizePlayerName(player?.username);
        return username.length > 0 ? username : `Joueur ${playerId}`;
    }
    appendTurnAnnouncement(state, playerId, playerNameResolver) {
        if (typeof playerId !== 'number' || !Number.isFinite(playerId)) return state;
        const label = typeof playerNameResolver === 'function' ? playerNameResolver(state, playerId) : this.playerName(state, playerId);
        return this.core.appendLog(state, (0, _gamelogtexthelper.turnAnnouncement)(label));
    }
    constructor(core){
        this.core = core;
    }
};
TurnPoliciesService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService
    ])
], TurnPoliciesService);
