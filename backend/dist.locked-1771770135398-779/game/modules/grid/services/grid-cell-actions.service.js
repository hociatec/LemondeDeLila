"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridCellActionsService = void 0;
const common_1 = require("@nestjs/common");
let GridCellActionsService = class GridCellActionsService {
    buildFromActions(actionsRaw, resolveLabel) {
        const result = {};
        const actions = Array.isArray(actionsRaw) ? actionsRaw : [];
        for (const action of actions) {
            const payload = action?.payload ?? {};
            const x = payload?.x;
            const y = payload?.y;
            if (typeof x !== 'number' || typeof y !== 'number') {
                continue;
            }
            const type = String(action?.type ?? '').trim();
            if (!type)
                continue;
            const key = `${x},${y}`;
            const label = typeof resolveLabel === 'function'
                ? String(resolveLabel(action) ?? '').trim()
                : String(action?.label ?? action?.type ?? '').trim();
            (result[key] ??= []).push({
                type,
                label: label || type,
                payload,
            });
        }
        return result;
    }
};
exports.GridCellActionsService = GridCellActionsService;
exports.GridCellActionsService = GridCellActionsService = __decorate([
    (0, common_1.Injectable)()
], GridCellActionsService);
//# sourceMappingURL=grid-cell-actions.service.js.map