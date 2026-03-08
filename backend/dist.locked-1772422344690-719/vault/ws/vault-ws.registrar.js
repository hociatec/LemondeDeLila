"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "VaultWsRegistrar", {
    enumerable: true,
    get: function() {
        return VaultWsRegistrar;
    }
});
const _common = require("@nestjs/common");
const _wsrouteregistryservice = require("../../common/ws/ws-route-registry.service");
const _vaultwshandler = require("./vault-ws.handler");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let VaultWsRegistrar = class VaultWsRegistrar {
    onModuleInit() {
        this.registry.register('vault.list', (s)=>this.handler.list(s));
        this.registry.register('vault.save', (s, p)=>this.handler.save(s, p));
        this.registry.register('vault.restore', (s, p)=>this.handler.restore(s, p));
        this.registry.register('vault.delete', (s, p)=>this.handler.delete(s, p));
        this.registry.register('vault.abandon', (s, p)=>this.handler.abandon(s, p));
    }
    constructor(registry, handler){
        this.registry = registry;
        this.handler = handler;
    }
};
VaultWsRegistrar = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsrouteregistryservice.WsRouteRegistry === "undefined" ? Object : _wsrouteregistryservice.WsRouteRegistry,
        typeof _vaultwshandler.VaultWsHandler === "undefined" ? Object : _vaultwshandler.VaultWsHandler
    ])
], VaultWsRegistrar);
