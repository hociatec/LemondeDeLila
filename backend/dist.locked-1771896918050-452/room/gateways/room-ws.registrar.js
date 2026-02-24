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
exports.RoomWsRegistrar = void 0;
const common_1 = require("@nestjs/common");
const ws_route_registry_service_1 = require("../../common/ws/ws-route-registry.service");
const room_directory_ws_handler_1 = require("./room-directory-ws.handler");
let RoomWsRegistrar = class RoomWsRegistrar {
    registry;
    handler;
    constructor(registry, handler) {
        this.registry = registry;
        this.handler = handler;
    }
    onModuleInit() {
        this.registry.register('rooms.public.list', (session, payload) => this.handler.listPublic(session, payload));
        this.registry.register('rooms.public.join', (session, payload) => this.handler.joinPublic(session, payload));
        this.registry.register('rooms.public.leave', (session, payload) => this.handler.leavePublic(session, payload));
        this.registry.register('rooms.public.spectate', (session, payload) => this.handler.spectatePublic(session, payload));
        this.registry.register('rooms.public.subscribe', (session, payload) => this.handler.subscribePublic(session, payload));
        this.registry.register('rooms.public.unsubscribe', (session) => this.handler.unsubscribePublic(session));
        this.registry.register('rooms.invite.send', (session, payload) => this.handler.inviteSend(session, payload));
        this.registry.register('rooms.invite.presence.list', (session, payload) => this.handler.invitePresenceList(session, payload));
        this.registry.register('rooms.invite.respond', (session, payload) => this.handler.inviteRespond(session, payload));
    }
};
exports.RoomWsRegistrar = RoomWsRegistrar;
exports.RoomWsRegistrar = RoomWsRegistrar = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ws_route_registry_service_1.WsRouteRegistry,
        room_directory_ws_handler_1.RoomDirectoryWsHandler])
], RoomWsRegistrar);
//# sourceMappingURL=room-ws.registrar.js.map