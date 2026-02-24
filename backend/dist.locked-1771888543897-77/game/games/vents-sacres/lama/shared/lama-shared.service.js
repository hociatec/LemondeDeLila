"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LamaSharedService = void 0;
const common_1 = require("@nestjs/common");
const string_value_utils_1 = require("../../../../../common/utils/string-value.utils");
let LamaSharedService = class LamaSharedService {
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
    asNumberOrNull(value) {
        if (typeof value === 'number' && Number.isFinite(value))
            return value;
        if (typeof value === 'string') {
            const n = Number(value.trim());
            return Number.isFinite(n) ? n : null;
        }
        return null;
    }
    asBoolean(value) {
        if (value === true)
            return true;
        if (value === false)
            return false;
        if (typeof value === 'number')
            return value === 1;
        if (typeof value === 'string') {
            const t = value.trim().toLowerCase();
            if (t === 'true' || t === '1' || t === 'yes' || t === 'oui' || t === 'on')
                return true;
            if (t === 'false' ||
                t === '0' ||
                t === 'no' ||
                t === 'non' ||
                t === 'off')
                return false;
        }
        return false;
    }
    playerLabel(players, playerId) {
        const raw = players.find((p) => p?.id === playerId)?.username;
        const name = this.sanitizePlayerName(raw);
        return name.length ? name : `joueur ${playerId}`;
    }
    ensureTurnTracker(meta, playerId) {
        const current = meta.turnTracker ?? {
            playerId,
            drawn: false,
            played: false,
        };
        const currentPid = this.asNumberOrNull(current?.playerId);
        if (currentPid !== playerId) {
            return {
                ...meta,
                turnTracker: { playerId, drawn: false, played: false, drawCount: 0 },
            };
        }
        const drawCountRaw = this.asNumberOrNull(current?.drawCount);
        const drawn = this.asBoolean(current?.drawn);
        const drawCount = Number.isFinite(drawCountRaw)
            ? Math.max(0, Math.floor(drawCountRaw))
            : drawn
                ? 1
                : 0;
        return {
            ...meta,
            turnTracker: {
                playerId,
                drawn,
                played: this.asBoolean(current?.played),
                drawCount,
            },
        };
    }
    getMaxDrawsPerTurn(meta) {
        if (!this.asBoolean(meta?.allowPlayAfterDraw))
            return 1;
        const raw = this.asNumberOrNull(meta?.maxDrawsPerTurn);
        if (!Number.isFinite(raw))
            return 1;
        return Math.max(1, Math.min(3, Math.floor(raw)));
    }
    getCurrentTurnDrawCount(meta, playerId, turnIndex) {
        let count = 0;
        const tracker = meta.turnTracker ?? null;
        const trackerPlayerId = this.asNumberOrNull(tracker?.playerId);
        const trackerDrawn = this.asBoolean(tracker?.drawn);
        if (trackerPlayerId === playerId && trackerDrawn) {
            const trackerCount = this.asNumberOrNull(tracker?.drawCount);
            count = Math.max(count, Number.isFinite(trackerCount)
                ? Math.max(1, Math.floor(trackerCount))
                : 1);
        }
        const drawTracker = meta?.drawTrackerByPlayerId;
        const entry = drawTracker && typeof drawTracker === 'object'
            ? drawTracker[String(playerId)]
            : null;
        const trackedTurn = this.asNumberOrNull(entry?.turnIndex);
        const trackedCount = this.asNumberOrNull(entry?.count);
        if (trackedTurn != null &&
            trackedTurn === turnIndex &&
            trackedCount != null &&
            trackedCount >= 1) {
            count = Math.max(count, Math.floor(trackedCount));
        }
        const lastDrawMap = meta?.lastDrawTurnIndexByPlayerId ?? null;
        const lastDrawIndex = lastDrawMap && typeof lastDrawMap === 'object'
            ? this.asNumberOrNull(lastDrawMap[String(playerId)])
            : null;
        if (lastDrawIndex != null && lastDrawIndex === turnIndex) {
            count = Math.max(count, 1);
        }
        return count;
    }
};
exports.LamaSharedService = LamaSharedService;
exports.LamaSharedService = LamaSharedService = __decorate([
    (0, common_1.Injectable)()
], LamaSharedService);
//# sourceMappingURL=lama-shared.service.js.map