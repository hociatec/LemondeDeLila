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
exports.PublicRoomDirectoryBinder = void 0;
const common_1 = require("@nestjs/common");
const room_service_1 = require("./room.service");
const public_room_directory_service_1 = require("./public-room-directory.service");
let PublicRoomDirectoryBinder = class PublicRoomDirectoryBinder {
    rooms;
    directory;
    constructor(rooms, directory) {
        this.rooms = rooms;
        this.directory = directory;
    }
    onModuleInit() {
        this.rooms.setDirectoryNotifier((roomId, reason) => this.directory.notifyRefresh(roomId, reason));
    }
};
exports.PublicRoomDirectoryBinder = PublicRoomDirectoryBinder;
exports.PublicRoomDirectoryBinder = PublicRoomDirectoryBinder = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [room_service_1.RoomService,
        public_room_directory_service_1.PublicRoomDirectoryService])
], PublicRoomDirectoryBinder);
//# sourceMappingURL=public-room-directory.binder.js.map