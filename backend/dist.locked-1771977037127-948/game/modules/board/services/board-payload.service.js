"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoardPayloadService = void 0;
const common_1 = require("@nestjs/common");
const string_value_utils_1 = require("../../../../common/utils/string-value.utils");
let BoardPayloadService = class BoardPayloadService {
    buildTilesPositionsLaps(tilesRaw, positionsRaw, lapsRaw) {
        const tiles = Array.isArray(tilesRaw) ? tilesRaw : [];
        const positions = {};
        if (positionsRaw &&
            typeof positionsRaw === 'object' &&
            !Array.isArray(positionsRaw)) {
            for (const [k, v] of Object.entries(positionsRaw)) {
                const n = typeof v === 'number' ? v : Number.parseInt((0, string_value_utils_1.stringOrEmpty)(v), 10);
                if (!Number.isFinite(n))
                    continue;
                positions[String(k)] = Math.trunc(n);
            }
        }
        const laps = {};
        if (lapsRaw && typeof lapsRaw === 'object' && !Array.isArray(lapsRaw)) {
            for (const [k, v] of Object.entries(lapsRaw)) {
                const n = typeof v === 'number' ? v : Number.parseInt((0, string_value_utils_1.stringOrEmpty)(v), 10);
                if (!Number.isFinite(n))
                    continue;
                laps[String(k)] = Math.trunc(n);
            }
        }
        return Object.keys(laps).length > 0
            ? { tiles, positions, laps }
            : { tiles, positions };
    }
    buildPositionPanelMessage(params) {
        const playerId = params.playerId;
        if (typeof playerId !== 'number' || !Number.isFinite(playerId)) {
            return 'Position: inconnue.';
        }
        const board = this.buildTilesPositionsLaps(params.tilesRaw, params.positionsRaw, params.lapsRaw);
        const totalTiles = board.tiles.length;
        const pos = board.positions[String(playerId)];
        if (!Number.isFinite(pos) || totalTiles <= 0) {
            return 'Position: inconnue.';
        }
        const caseNumber = Math.max(1, Math.trunc(pos) + 1);
        const lap = board.laps?.[String(playerId)];
        const tourPlateau = Number.isFinite(lap)
            ? String(Math.trunc(lap))
            : '?';
        return `Tour plateau ${tourPlateau}, case ${caseNumber}/${totalTiles}.`;
    }
};
exports.BoardPayloadService = BoardPayloadService;
exports.BoardPayloadService = BoardPayloadService = __decorate([
    (0, common_1.Injectable)()
], BoardPayloadService);
//# sourceMappingURL=board-payload.service.js.map