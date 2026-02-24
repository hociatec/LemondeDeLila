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
exports.MessagingWsRegistrar = void 0;
const common_1 = require("@nestjs/common");
const ws_route_registry_service_1 = require("../../common/ws/ws-route-registry.service");
const messaging_ws_handler_1 = require("./messaging-ws.handler");
let MessagingWsRegistrar = class MessagingWsRegistrar {
    registry;
    handler;
    constructor(registry, handler) {
        this.registry = registry;
        this.handler = handler;
    }
    onModuleInit() {
        this.registry.register('messaging.conversation', (session, payload) => this.handler.conversation(session, payload));
        this.registry.register('messaging.messages', (session, payload) => this.handler.messages(session, payload));
        this.registry.register('messaging.send', (session, payload) => this.handler.send(session, payload));
        this.registry.register('messaging.delete', (session, payload) => this.handler.delete(session, payload));
        this.registry.register('messaging.restore', (session, payload) => this.handler.restore(session, payload));
        this.registry.register('messaging.purge', (session, payload) => this.handler.purge(session, payload));
        this.registry.register('messaging.markRead', (session, payload) => this.handler.markRead(session, payload));
        this.registry.register('messaging.search', (_, payload) => this.handler.search(payload));
    }
};
exports.MessagingWsRegistrar = MessagingWsRegistrar;
exports.MessagingWsRegistrar = MessagingWsRegistrar = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ws_route_registry_service_1.WsRouteRegistry,
        messaging_ws_handler_1.MessagingWsHandler])
], MessagingWsRegistrar);
//# sourceMappingURL=messaging-ws.registrar.js.map