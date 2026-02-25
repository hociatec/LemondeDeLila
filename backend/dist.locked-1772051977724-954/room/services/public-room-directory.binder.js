"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PublicRoomDirectoryBinder", {
    enumerable: true,
    get: function() {
        return PublicRoomDirectoryBinder;
    }
});
const _common = require("@nestjs/common");
const _roomservice = require("./room.service");
const _publicroomdirectoryservice = require("./public-room-directory.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let PublicRoomDirectoryBinder = class PublicRoomDirectoryBinder {
    onModuleInit() {
        this.rooms.setDirectoryNotifier((roomId, reason)=>this.directory.notifyRefresh(roomId, reason));
    }
    constructor(rooms, directory){
        this.rooms = rooms;
        this.directory = directory;
    }
};
PublicRoomDirectoryBinder = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _roomservice.RoomService === "undefined" ? Object : _roomservice.RoomService,
        typeof _publicroomdirectoryservice.PublicRoomDirectoryService === "undefined" ? Object : _publicroomdirectoryservice.PublicRoomDirectoryService
    ])
], PublicRoomDirectoryBinder);
