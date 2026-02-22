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
exports.UserWsRegistrar = void 0;
const common_1 = require("@nestjs/common");
const ws_route_registry_service_1 = require("../../common/ws/ws-route-registry.service");
const auth_ws_handler_1 = require("./auth-ws.handler");
const user_ws_handler_1 = require("./user-ws.handler");
let UserWsRegistrar = class UserWsRegistrar {
    registry;
    auth;
    users;
    constructor(registry, auth, users) {
        this.registry = registry;
        this.auth = auth;
        this.users = users;
    }
    onModuleInit() {
        this.registry.register('auth.register', (_, payload) => this.auth.register(payload));
        this.registry.register('auth.login', (_, payload) => this.auth.login(payload));
        this.registry.register('users.list', () => this.users.list());
        this.registry.register('users.get', (_, payload) => this.users.get(payload));
    }
};
exports.UserWsRegistrar = UserWsRegistrar;
exports.UserWsRegistrar = UserWsRegistrar = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ws_route_registry_service_1.WsRouteRegistry,
        auth_ws_handler_1.AuthWsHandler,
        user_ws_handler_1.UserWsHandler])
], UserWsRegistrar);
//# sourceMappingURL=user-ws.registrar.js.map