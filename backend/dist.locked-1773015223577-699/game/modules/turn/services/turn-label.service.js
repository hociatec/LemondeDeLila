"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TurnLabelService", {
    enumerable: true,
    get: function() {
        return TurnLabelService;
    }
});
const _common = require("@nestjs/common");
const _stringvalueutils = require("../../../../common/utils/string-value.utils");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let TurnLabelService = class TurnLabelService {
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
    compute(state, gameType) {
        const status = (state?.status ?? '').toLowerCase().trim();
        if (!status) return null;
        if (status === 'finished') return 'Partie terminée.';
        if (status !== 'started') {
            const formatted = (gameType ?? '').trim();
            const label = formatted ? formatted.split(/[-_ ]+/g).filter(Boolean).map((p)=>p.charAt(0).toUpperCase() + p.slice(1)).join(' ') : 'la table';
            return `Bienvenue sur ${label}. B pour ajouter un bot, Maj+B pour retirer un bot, Entrée pour démarrer la partie.`;
        }
        const players = Array.isArray(state.players) ? state.players : [];
        const currentPlayerId = state.turn?.currentPlayerId ?? null;
        const pendingType = String(state?.pending?.type ?? '').trim().toLowerCase();
        if (pendingType === 'choose_pawn' || pendingType === 'pick_pawn') {
            const pendingPlayerId = Number(state?.pending?.playerId);
            const targetPlayerId = Number.isFinite(pendingPlayerId) && pendingPlayerId > 0 ? pendingPlayerId : currentPlayerId;
            if (targetPlayerId != null) {
                const found = players.find((p)=>Number(p?.id) === targetPlayerId);
                const username = this.sanitizePlayerName(found?.username);
                const name = username.length > 0 ? username : `Joueur ${targetPlayerId}`;
                return `C'est à ${name} de choisir son pion.`;
            }
        }
        if (currentPlayerId != null) {
            const found = players.find((p)=>Number(p?.id) === currentPlayerId);
            const username = this.sanitizePlayerName(found?.username);
            const name = username.length > 0 ? username : `Joueur ${currentPlayerId}`;
            return `C'est à ${name} de jouer.`;
        }
        const idx = typeof state.turnIndex === 'number' ? state.turnIndex : -1;
        const byIndex = idx >= 0 && idx < players.length ? players[idx] : null;
        const username = this.sanitizePlayerName(byIndex?.username);
        const name = username.length > 0 ? username : byIndex?.id != null ? `Joueur ${byIndex.id}` : null;
        if (name) return `C'est à ${name} de jouer.`;
        return 'Tour en cours.';
    }
};
TurnLabelService = _ts_decorate([
    (0, _common.Injectable)()
], TurnLabelService);
