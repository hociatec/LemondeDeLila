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
exports.GameWsRegistrar = void 0;
const common_1 = require("@nestjs/common");
const ws_route_registry_service_1 = require("../../../common/ws/ws-route-registry.service");
const game_ws_handler_1 = require("./game-ws.handler");
let GameWsRegistrar = class GameWsRegistrar {
    registry;
    handler;
    constructor(registry, handler) {
        this.registry = registry;
        this.handler = handler;
    }
    onModuleInit() {
        const rulesHandler = (session, payload) => this.handler.rules(session, payload);
        this.registry.register('game.rules', rulesHandler);
        this.registry.register('game.rules.get', rulesHandler);
        this.registry.register('game.rulebook', rulesHandler);
        this.registry.register('game.rulebook.get', rulesHandler);
        this.registry.register('rules', rulesHandler);
        this.registry.register('game.modules', (session) => this.handler.modules(session));
    }
};
exports.GameWsRegistrar = GameWsRegistrar;
exports.GameWsRegistrar = GameWsRegistrar = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ws_route_registry_service_1.WsRouteRegistry,
        game_ws_handler_1.GameWsHandler])
], GameWsRegistrar);
//# sourceMappingURL=game-ws.registrar.js.map