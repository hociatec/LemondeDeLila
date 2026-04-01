"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RoomLobbyRefreshBinder", {
    enumerable: true,
    get: function() {
        return RoomLobbyRefreshBinder;
    }
});
const _common = require("@nestjs/common");
const _roomservice = require("./room.service");
const _roomlobbyrefreshservice = require("./room-lobby-refresh.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let RoomLobbyRefreshBinder = class RoomLobbyRefreshBinder {
    onModuleInit() {
        this.rooms.setLobbyNotifier((roomId, reason)=>this.lobbyRefresh.notifyRefresh(roomId, reason));
    }
    constructor(rooms, lobbyRefresh){
        this.rooms = rooms;
        this.lobbyRefresh = lobbyRefresh;
    }
};
RoomLobbyRefreshBinder = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _roomservice.RoomService === "undefined" ? Object : _roomservice.RoomService,
        typeof _roomlobbyrefreshservice.RoomLobbyRefreshService === "undefined" ? Object : _roomlobbyrefreshservice.RoomLobbyRefreshService
    ])
], RoomLobbyRefreshBinder);
