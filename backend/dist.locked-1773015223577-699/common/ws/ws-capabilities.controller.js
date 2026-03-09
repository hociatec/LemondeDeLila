"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WsCapabilitiesController", {
    enumerable: true,
    get: function() {
        return WsCapabilitiesController;
    }
});
const _common = require("@nestjs/common");
const _wsrouteregistryservice = require("./ws-route-registry.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let WsCapabilitiesController = class WsCapabilitiesController {
    getCapabilities() {
        return {
            ws: {
                types: this.routes.listTypes()
            }
        };
    }
    constructor(routes){
        this.routes = routes;
    }
};
_ts_decorate([
    (0, _common.Get)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], WsCapabilitiesController.prototype, "getCapabilities", null);
WsCapabilitiesController = _ts_decorate([
    (0, _common.Controller)('api/capabilities'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsrouteregistryservice.WsRouteRegistry === "undefined" ? Object : _wsrouteregistryservice.WsRouteRegistry
    ])
], WsCapabilitiesController);
