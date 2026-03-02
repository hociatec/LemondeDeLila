"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GridModule", {
    enumerable: true,
    get: function() {
        return GridModule;
    }
});
const _common = require("@nestjs/common");
const _gridrenderservice = require("./services/grid-render.service");
const _gridblockededgesservice = require("./services/grid-blocked-edges.service");
const _gridcellactionsservice = require("./services/grid-cell-actions.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let GridModule = class GridModule {
};
GridModule = _ts_decorate([
    (0, _common.Module)({
        providers: [
            _gridrenderservice.GridRenderService,
            _gridblockededgesservice.GridBlockedEdgesService,
            _gridcellactionsservice.GridCellActionsService
        ],
        exports: [
            _gridrenderservice.GridRenderService,
            _gridblockededgesservice.GridBlockedEdgesService,
            _gridcellactionsservice.GridCellActionsService
        ]
    })
], GridModule);
