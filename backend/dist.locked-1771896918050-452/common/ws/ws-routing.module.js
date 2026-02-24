"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsRoutingModule = void 0;
const common_1 = require("@nestjs/common");
const ws_route_registry_service_1 = require("./ws-route-registry.service");
const ws_jwt_auth_service_1 = require("./ws-jwt-auth.service");
const ws_signature_service_1 = require("./ws-signature.service");
const ws_api_hub_service_1 = require("./ws-api-hub.service");
const ws_capabilities_controller_1 = require("./ws-capabilities.controller");
let WsRoutingModule = class WsRoutingModule {
};
exports.WsRoutingModule = WsRoutingModule;
exports.WsRoutingModule = WsRoutingModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        controllers: [ws_capabilities_controller_1.WsCapabilitiesController],
        providers: [
            ws_route_registry_service_1.WsRouteRegistry,
            ws_jwt_auth_service_1.WsJwtAuthService,
            ws_signature_service_1.WsSignatureService,
            ws_api_hub_service_1.WsApiHubService,
        ],
        exports: [
            ws_route_registry_service_1.WsRouteRegistry,
            ws_jwt_auth_service_1.WsJwtAuthService,
            ws_signature_service_1.WsSignatureService,
            ws_api_hub_service_1.WsApiHubService,
        ],
    })
], WsRoutingModule);
//# sourceMappingURL=ws-routing.module.js.map