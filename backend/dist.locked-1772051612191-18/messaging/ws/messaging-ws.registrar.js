"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MessagingWsRegistrar", {
    enumerable: true,
    get: function() {
        return MessagingWsRegistrar;
    }
});
const _common = require("@nestjs/common");
const _wsrouteregistryservice = require("../../common/ws/ws-route-registry.service");
const _messagingwshandler = require("./messaging-ws.handler");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let MessagingWsRegistrar = class MessagingWsRegistrar {
    onModuleInit() {
        this.registry.register('messaging.conversation', (session, payload)=>this.handler.conversation(session, payload));
        this.registry.register('messaging.messages', (session, payload)=>this.handler.messages(session, payload));
        this.registry.register('messaging.send', (session, payload)=>this.handler.send(session, payload));
        this.registry.register('messaging.delete', (session, payload)=>this.handler.delete(session, payload));
        this.registry.register('messaging.restore', (session, payload)=>this.handler.restore(session, payload));
        this.registry.register('messaging.purge', (session, payload)=>this.handler.purge(session, payload));
        this.registry.register('messaging.markRead', (session, payload)=>this.handler.markRead(session, payload));
        this.registry.register('messaging.search', (_, payload)=>this.handler.search(payload));
    }
    constructor(registry, handler){
        this.registry = registry;
        this.handler = handler;
    }
};
MessagingWsRegistrar = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsrouteregistryservice.WsRouteRegistry === "undefined" ? Object : _wsrouteregistryservice.WsRouteRegistry,
        typeof _messagingwshandler.MessagingWsHandler === "undefined" ? Object : _messagingwshandler.MessagingWsHandler
    ])
], MessagingWsRegistrar);
