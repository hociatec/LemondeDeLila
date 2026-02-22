"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdysseeSetupService = void 0;
const common_1 = require("@nestjs/common");
let OdysseeSetupService = class OdysseeSetupService {
    hydrateInitialState(base) {
        const players = Array.isArray(base.players) ? base.players : [];
        const trackLength = 56;
        const homeLength = 6;
        const offsets = {};
        players.forEach((p, i) => {
            offsets[p.id] = (i * 14) % trackLength;
        });
        const pawnsByPlayer = {};
        for (const p of players) {
            pawnsByPlayer[p.id] = [0, 1, 2, 3].map((pawnIndex) => ({
                pawnIndex,
                progress: -1,
            }));
        }
        const meta = {
            trackLength,
            homeLength,
            offsets,
            safeTiles: [],
            pawnsByPlayer,
            winnerId: null,
        };
        return {
            ...base,
            phase: 'playing',
            pending: null,
            metadata: { ...(base.metadata ?? {}), ...meta },
        };
    }
};
exports.OdysseeSetupService = OdysseeSetupService;
exports.OdysseeSetupService = OdysseeSetupService = __decorate([
    (0, common_1.Injectable)()
], OdysseeSetupService);
//# sourceMappingURL=odyssee-setup.service.js.map