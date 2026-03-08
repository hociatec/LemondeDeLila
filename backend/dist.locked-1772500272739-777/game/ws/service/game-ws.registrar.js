"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameWsRegistrar", {
    enumerable: true,
    get: function() {
        return GameWsRegistrar;
    }
});
const _common = require("@nestjs/common");
const _wsrouteregistryservice = require("../../../common/ws/ws-route-registry.service");
const _gamewshandler = require("./game-ws.handler");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let GameWsRegistrar = class GameWsRegistrar {
    onModuleInit() {
        // Rules fetching: keep backward-compatible aliases.
        const rulesHandler = (session, payload)=>this.handler.rules(session, payload);
        this.registry.register('game.rules', rulesHandler);
        this.registry.register('game.rules.get', rulesHandler);
        this.registry.register('game.rulebook', rulesHandler);
        this.registry.register('game.rulebook.get', rulesHandler);
        this.registry.register('rules', rulesHandler);
        this.registry.register('game.modules', (session)=>this.handler.modules(session));
    }
    constructor(registry, handler){
        this.registry = registry;
        this.handler = handler;
    }
};
GameWsRegistrar = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsrouteregistryservice.WsRouteRegistry === "undefined" ? Object : _wsrouteregistryservice.WsRouteRegistry,
        typeof _gamewshandler.GameWsHandler === "undefined" ? Object : _gamewshandler.GameWsHandler
    ])
], GameWsRegistrar);
