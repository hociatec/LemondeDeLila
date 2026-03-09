"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WsApiHubService", {
    enumerable: true,
    get: function() {
        return WsApiHubService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let WsApiHubService = class WsApiHubService {
    register(connectionId, socket) {
        if (!connectionId || !connectionId.trim()) return;
        this.socketsByConnectionId.set(connectionId, socket);
    }
    unregister(connectionId) {
        if (!connectionId || !connectionId.trim()) return;
        this.socketsByConnectionId.delete(connectionId);
    }
    send(connectionId, message) {
        const socket = this.socketsByConnectionId.get(connectionId);
        if (!socket) return false;
        if (socket.readyState !== 1 /* OPEN */ ) {
            this.socketsByConnectionId.delete(connectionId);
            return false;
        }
        try {
            socket.send(JSON.stringify(message));
            return true;
        } catch (err) {
            const error = err instanceof Error ? err : undefined;
            this.logger.debug(`Echec envoi WS push connectionId=${connectionId}`, error);
            this.socketsByConnectionId.delete(connectionId);
            try {
                socket.close();
            } catch  {
            /* ignore */ }
            return false;
        }
    }
    constructor(){
        this.logger = new _common.Logger(WsApiHubService.name);
        this.socketsByConnectionId = new Map();
    }
};
WsApiHubService = _ts_decorate([
    (0, _common.Injectable)()
], WsApiHubService);
