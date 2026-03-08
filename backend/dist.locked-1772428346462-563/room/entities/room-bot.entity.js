"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RoomBot", {
    enumerable: true,
    get: function() {
        return RoomBot;
    }
});
const _typeorm = require("typeorm");
const _roomentity = require("./room.entity");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let RoomBot = class RoomBot {
};
_ts_decorate([
    (0, _typeorm.PrimaryGeneratedColumn)(),
    _ts_metadata("design:type", Number)
], RoomBot.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.ManyToOne)(()=>_roomentity.Room, {
        onDelete: 'CASCADE'
    }),
    (0, _typeorm.JoinColumn)({
        name: 'room_id'
    }),
    _ts_metadata("design:type", typeof _typeorm.Relation === "undefined" ? Object : _typeorm.Relation)
], RoomBot.prototype, "room", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 100
    }),
    _ts_metadata("design:type", String)
], RoomBot.prototype, "name", void 0);
_ts_decorate([
    (0, _typeorm.CreateDateColumn)({
        name: 'created_at',
        type: 'datetime'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], RoomBot.prototype, "createdAt", void 0);
RoomBot = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'room_bots'
    })
], RoomBot);
