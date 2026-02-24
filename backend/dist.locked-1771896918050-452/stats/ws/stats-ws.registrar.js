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
exports.StatsWsRegistrar = void 0;
const common_1 = require("@nestjs/common");
const ws_route_registry_service_1 = require("../../common/ws/ws-route-registry.service");
const stats_ws_handler_1 = require("./stats-ws.handler");
let StatsWsRegistrar = class StatsWsRegistrar {
    registry;
    handler;
    constructor(registry, handler) {
        this.registry = registry;
        this.handler = handler;
    }
    onModuleInit() {
        this.registry.register('stats.my', (session) => this.handler.my(session));
        this.registry.register('stats.user', (session, payload) => this.handler.user(session, payload));
        this.registry.register('leaderboard.games', () => this.handler.leaderboardGames());
        this.registry.register('leaderboard.top', (_, payload) => this.handler.leaderboardTop(payload));
    }
};
exports.StatsWsRegistrar = StatsWsRegistrar;
exports.StatsWsRegistrar = StatsWsRegistrar = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ws_route_registry_service_1.WsRouteRegistry,
        stats_ws_handler_1.StatsWsHandler])
], StatsWsRegistrar);
//# sourceMappingURL=stats-ws.registrar.js.map