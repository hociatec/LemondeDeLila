"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "UserWsRegistrar", {
    enumerable: true,
    get: function() {
        return UserWsRegistrar;
    }
});
const _common = require("@nestjs/common");
const _wsrouteregistryservice = require("../../common/ws/ws-route-registry.service");
const _authwshandler = require("./auth-ws.handler");
const _userwshandler = require("./user-ws.handler");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let UserWsRegistrar = class UserWsRegistrar {
    onModuleInit() {
        this.registry.register('auth.register', (_, payload)=>this.auth.register(payload));
        this.registry.register('auth.login', (_, payload)=>this.auth.login(payload));
        this.registry.register('users.list', ()=>this.users.list());
        this.registry.register('users.get', (_, payload)=>this.users.get(payload));
    }
    constructor(registry, auth, users){
        this.registry = registry;
        this.auth = auth;
        this.users = users;
    }
};
UserWsRegistrar = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsrouteregistryservice.WsRouteRegistry === "undefined" ? Object : _wsrouteregistryservice.WsRouteRegistry,
        typeof _authwshandler.AuthWsHandler === "undefined" ? Object : _authwshandler.AuthWsHandler,
        typeof _userwshandler.UserWsHandler === "undefined" ? Object : _userwshandler.UserWsHandler
    ])
], UserWsRegistrar);
