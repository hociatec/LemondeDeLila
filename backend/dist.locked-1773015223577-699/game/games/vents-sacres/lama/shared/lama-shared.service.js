"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaSharedService", {
    enumerable: true,
    get: function() {
        return LamaSharedService;
    }
});
const _common = require("@nestjs/common");
const _stringvalueutils = require("../../../../../common/utils/string-value.utils");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let LamaSharedService = class LamaSharedService {
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
    asNumberOrNull(value) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
            const n = Number(value.trim());
            return Number.isFinite(n) ? n : null;
        }
        return null;
    }
    asBoolean(value) {
        if (value === true) return true;
        if (value === false) return false;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string') {
            const t = value.trim().toLowerCase();
            if (t === 'true' || t === '1' || t === 'yes' || t === 'oui' || t === 'on') return true;
            if (t === 'false' || t === '0' || t === 'no' || t === 'non' || t === 'off') return false;
        }
        return false;
    }
    playerLabel(players, playerId) {
        const raw = players.find((p)=>p?.id === playerId)?.username;
        const name = this.sanitizePlayerName(raw);
        return name.length ? name : `joueur ${playerId}`;
    }
    ensureTurnTracker(meta, playerId) {
        const current = meta.turnTracker ?? {
            playerId,
            drawn: false,
            played: false
        };
        const currentPid = this.asNumberOrNull(current?.playerId);
        if (currentPid !== playerId) {
            return {
                ...meta,
                turnTracker: {
                    playerId,
                    drawn: false,
                    played: false
                }
            };
        }
        return {
            ...meta,
            turnTracker: {
                playerId,
                drawn: this.asBoolean(current?.drawn),
                played: this.asBoolean(current?.played)
            }
        };
    }
    isDrawLocked(meta) {
        if (meta.allowDrawAfterFirstQuit) return false;
        const dropped = meta.droppedOutByPlayerId ?? {};
        const hands = meta.handsByPlayerId ?? {};
        // Only consider players actually in the round.
        // Eliminated players are not in `handsByPlayerId`, but may remain flagged as dropped.
        return Object.keys(hands).some((pid)=>Boolean(dropped[pid]));
    }
};
LamaSharedService = _ts_decorate([
    (0, _common.Injectable)()
], LamaSharedService);
