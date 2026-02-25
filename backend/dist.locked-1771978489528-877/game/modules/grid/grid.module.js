"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridModule = void 0;
const common_1 = require("@nestjs/common");
const grid_render_service_1 = require("./services/grid-render.service");
const grid_blocked_edges_service_1 = require("./services/grid-blocked-edges.service");
const grid_cell_actions_service_1 = require("./services/grid-cell-actions.service");
let GridModule = class GridModule {
};
exports.GridModule = GridModule;
exports.GridModule = GridModule = __decorate([
    (0, common_1.Module)({
        providers: [
            grid_render_service_1.GridRenderService,
            grid_blocked_edges_service_1.GridBlockedEdgesService,
            grid_cell_actions_service_1.GridCellActionsService,
        ],
        exports: [grid_render_service_1.GridRenderService, grid_blocked_edges_service_1.GridBlockedEdgesService, grid_cell_actions_service_1.GridCellActionsService],
    })
], GridModule);
//# sourceMappingURL=grid.module.js.map