"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RoomWsRegistrar", {
    enumerable: true,
    get: function() {
        return RoomWsRegistrar;
    }
});
const _common = require("@nestjs/common");
const _wsrouteregistryservice = require("../../common/ws/ws-route-registry.service");
const _roomdirectorywshandler = require("./room-directory-ws.handler");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let RoomWsRegistrar = class RoomWsRegistrar {
    onModuleInit() {
        this.registry.register('rooms.public.list', (session, payload)=>this.handler.listPublic(session, payload));
        this.registry.register('rooms.public.join', (session, payload)=>this.handler.joinPublic(session, payload));
        this.registry.register('rooms.public.leave', (session, payload)=>this.handler.leavePublic(session, payload));
        this.registry.register('rooms.public.spectate', (session, payload)=>this.handler.spectatePublic(session, payload));
        this.registry.register('rooms.public.subscribe', (session, payload)=>this.handler.subscribePublic(session, payload));
        this.registry.register('rooms.public.unsubscribe', (session)=>this.handler.unsubscribePublic(session));
        this.registry.register('rooms.invite.send', (session, payload)=>this.handler.inviteSend(session, payload));
        this.registry.register('rooms.invite.presence.list', (session, payload)=>this.handler.invitePresenceList(session, payload));
        this.registry.register('rooms.invite.respond', (session, payload)=>this.handler.inviteRespond(session, payload));
    }
    constructor(registry, handler){
        this.registry = registry;
        this.handler = handler;
    }
};
RoomWsRegistrar = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsrouteregistryservice.WsRouteRegistry === "undefined" ? Object : _wsrouteregistryservice.WsRouteRegistry,
        typeof _roomdirectorywshandler.RoomDirectoryWsHandler === "undefined" ? Object : _roomdirectorywshandler.RoomDirectoryWsHandler
    ])
], RoomWsRegistrar);
