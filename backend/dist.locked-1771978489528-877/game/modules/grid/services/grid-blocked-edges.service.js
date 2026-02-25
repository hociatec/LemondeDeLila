"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridBlockedEdgesService = void 0;
const common_1 = require("@nestjs/common");
let GridBlockedEdgesService = class GridBlockedEdgesService {
    buildFromWalls(size, walls) {
        const s = Number(size);
        if (!Number.isFinite(s) || s <= 0 || s > 50) {
            return {};
        }
        const h = new Set((walls?.h ?? []).map((k) => String(k)));
        const v = new Set((walls?.v ?? []).map((k) => String(k)));
        const hasH = (x, y) => h.has(`${x},${y}`);
        const hasV = (x, y) => v.has(`${x},${y}`);
        const blocked = {};
        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const south = y === s - 1 ? true : hasH(x, y) || hasH(x - 1, y);
                const north = y === 0 ? true : hasH(x, y - 1) || hasH(x - 1, y - 1);
                const east = x === s - 1 ? true : hasV(x, y) || hasV(x, y - 1);
                const west = x === 0 ? true : hasV(x - 1, y) || hasV(x - 1, y - 1);
                blocked[`${x},${y}`] = { n: north, e: east, s: south, w: west };
            }
        }
        return blocked;
    }
};
exports.GridBlockedEdgesService = GridBlockedEdgesService;
exports.GridBlockedEdgesService = GridBlockedEdgesService = __decorate([
    (0, common_1.Injectable)()
], GridBlockedEdgesService);
//# sourceMappingURL=grid-blocked-edges.service.js.map