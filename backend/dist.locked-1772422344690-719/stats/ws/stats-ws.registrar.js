"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "StatsWsRegistrar", {
    enumerable: true,
    get: function() {
        return StatsWsRegistrar;
    }
});
const _common = require("@nestjs/common");
const _wsrouteregistryservice = require("../../common/ws/ws-route-registry.service");
const _statswshandler = require("./stats-ws.handler");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let StatsWsRegistrar = class StatsWsRegistrar {
    onModuleInit() {
        this.registry.register('stats.my', (session)=>this.handler.my(session));
        this.registry.register('stats.user', (session, payload)=>this.handler.user(session, payload));
        this.registry.register('leaderboard.games', ()=>this.handler.leaderboardGames());
        this.registry.register('leaderboard.top', (_, payload)=>this.handler.leaderboardTop(payload));
    }
    constructor(registry, handler){
        this.registry = registry;
        this.handler = handler;
    }
};
StatsWsRegistrar = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsrouteregistryservice.WsRouteRegistry === "undefined" ? Object : _wsrouteregistryservice.WsRouteRegistry,
        typeof _statswshandler.StatsWsHandler === "undefined" ? Object : _statswshandler.StatsWsHandler
    ])
], StatsWsRegistrar);
