"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var WsApiHubService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsApiHubService = void 0;
const common_1 = require("@nestjs/common");
let WsApiHubService = WsApiHubService_1 = class WsApiHubService {
    logger = new common_1.Logger(WsApiHubService_1.name);
    socketsByConnectionId = new Map();
    register(connectionId, socket) {
        if (!connectionId || !connectionId.trim())
            return;
        this.socketsByConnectionId.set(connectionId, socket);
    }
    unregister(connectionId) {
        if (!connectionId || !connectionId.trim())
            return;
        this.socketsByConnectionId.delete(connectionId);
    }
    send(connectionId, message) {
        const socket = this.socketsByConnectionId.get(connectionId);
        if (!socket)
            return false;
        if (socket.readyState !== 1) {
            this.socketsByConnectionId.delete(connectionId);
            return false;
        }
        try {
            socket.send(JSON.stringify(message));
            return true;
        }
        catch (err) {
            const error = err instanceof Error ? err : undefined;
            this.logger.debug(`Echec envoi WS push connectionId=${connectionId}`, error);
            this.socketsByConnectionId.delete(connectionId);
            try {
                socket.close();
            }
            catch {
            }
            return false;
        }
    }
};
exports.WsApiHubService = WsApiHubService;
exports.WsApiHubService = WsApiHubService = WsApiHubService_1 = __decorate([
    (0, common_1.Injectable)()
], WsApiHubService);
//# sourceMappingURL=ws-api-hub.service.js.map