"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridRenderService = void 0;
const common_1 = require("@nestjs/common");
let GridRenderService = class GridRenderService {
    attachGridRenderDescriptors(state) {
        const extras = state.extras && typeof state.extras === 'object' ? state.extras : {};
        const gridExisting = extras.grid;
        if (!gridExisting ||
            typeof gridExisting !== 'object' ||
            Array.isArray(gridExisting)) {
            return state;
        }
        const grid = { ...gridExisting };
        if (grid.render !== undefined) {
            return state;
        }
        const blockedEdges = grid.blockedEdges;
        if (!blockedEdges ||
            typeof blockedEdges !== 'object' ||
            Array.isArray(blockedEdges)) {
            return state;
        }
        const sizeRaw = grid.size;
        const size = typeof sizeRaw === 'number'
            ? sizeRaw
            : typeof sizeRaw === 'string'
                ? Number.parseInt(sizeRaw, 10)
                : NaN;
        if (!Number.isFinite(size) || size <= 0 || size > 50) {
            return state;
        }
        const thick = 4;
        const cells = {};
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const key = `${x},${y}`;
                const edges = blockedEdges[key];
                const isObj = edges && typeof edges === 'object' && !Array.isArray(edges);
                const nBlocked = isObj && edges.n === true;
                const eBlocked = isObj && edges.e === true;
                const sBlocked = isObj && edges.s === true;
                const wBlocked = isObj && edges.w === true;
                const n = nBlocked && y > 0;
                const s = sBlocked && y < size - 1;
                const w = wBlocked && x > 0;
                const e = eBlocked && x < size - 1;
                cells[key] = {
                    walls: { n, e, s, w },
                    border: {
                        l: w ? thick : 1,
                        t: n ? thick : 1,
                        r: e ? thick : 1,
                        b: s ? thick : 1,
                    },
                };
            }
        }
        grid.render = { cells, thick };
        return {
            ...state,
            extras: {
                ...extras,
                grid,
            },
        };
    }
};
exports.GridRenderService = GridRenderService;
exports.GridRenderService = GridRenderService = __decorate([
    (0, common_1.Injectable)()
], GridRenderService);
//# sourceMappingURL=grid-render.service.js.map