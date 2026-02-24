"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultWsRegistrar = void 0;
const common_1 = require("@nestjs/common");
const ws_route_registry_service_1 = require("../../common/ws/ws-route-registry.service");
const vault_ws_handler_1 = require("./vault-ws.handler");
let VaultWsRegistrar = class VaultWsRegistrar {
    registry;
    handler;
    constructor(registry, handler) {
        this.registry = registry;
        this.handler = handler;
    }
    onModuleInit() {
        this.registry.register('vault.list', (s) => this.handler.list(s));
        this.registry.register('vault.save', (s, p) => this.handler.save(s, p));
        this.registry.register('vault.restore', (s, p) => this.handler.restore(s, p));
        this.registry.register('vault.delete', (s, p) => this.handler.delete(s, p));
        this.registry.register('vault.abandon', (s, p) => this.handler.abandon(s, p));
    }
};
exports.VaultWsRegistrar = VaultWsRegistrar;
exports.VaultWsRegistrar = VaultWsRegistrar = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ws_route_registry_service_1.WsRouteRegistry,
        vault_ws_handler_1.VaultWsHandler])
], VaultWsRegistrar);
//# sourceMappingURL=vault-ws.registrar.js.map