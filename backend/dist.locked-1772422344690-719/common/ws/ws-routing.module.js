"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WsRoutingModule", {
    enumerable: true,
    get: function() {
        return WsRoutingModule;
    }
});
const _common = require("@nestjs/common");
const _wsrouteregistryservice = require("./ws-route-registry.service");
const _wsjwtauthservice = require("./ws-jwt-auth.service");
const _wssignatureservice = require("./ws-signature.service");
const _wsapihubservice = require("./ws-api-hub.service");
const _wscapabilitiescontroller = require("./ws-capabilities.controller");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let WsRoutingModule = class WsRoutingModule {
};
WsRoutingModule = _ts_decorate([
    (0, _common.Global)(),
    (0, _common.Module)({
        controllers: [
            _wscapabilitiescontroller.WsCapabilitiesController
        ],
        providers: [
            _wsrouteregistryservice.WsRouteRegistry,
            _wsjwtauthservice.WsJwtAuthService,
            _wssignatureservice.WsSignatureService,
            _wsapihubservice.WsApiHubService
        ],
        exports: [
            _wsrouteregistryservice.WsRouteRegistry,
            _wsjwtauthservice.WsJwtAuthService,
            _wssignatureservice.WsSignatureService,
            _wsapihubservice.WsApiHubService
        ]
    })
], WsRoutingModule);
