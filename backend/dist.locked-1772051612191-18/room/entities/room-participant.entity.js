"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RoomParticipant", {
    enumerable: true,
    get: function() {
        return RoomParticipant;
    }
});
const _typeorm = require("typeorm");
const _roomentity = require("./room.entity");
const _userentity = require("../../user/entities/user.entity");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let RoomParticipant = class RoomParticipant {
};
_ts_decorate([
    (0, _typeorm.PrimaryGeneratedColumn)(),
    _ts_metadata("design:type", Number)
], RoomParticipant.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.ManyToOne)(()=>_roomentity.Room, {
        onDelete: 'CASCADE'
    }),
    (0, _typeorm.JoinColumn)({
        name: 'room_id'
    }),
    _ts_metadata("design:type", typeof _roomentity.Room === "undefined" ? Object : _roomentity.Room)
], RoomParticipant.prototype, "room", void 0);
_ts_decorate([
    (0, _typeorm.ManyToOne)(()=>_userentity.User, {
        eager: true,
        onDelete: 'CASCADE'
    }),
    (0, _typeorm.JoinColumn)({
        name: 'user_id'
    }),
    _ts_metadata("design:type", typeof _userentity.User === "undefined" ? Object : _userentity.User)
], RoomParticipant.prototype, "user", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 20,
        default: 'player'
    }),
    _ts_metadata("design:type", String)
], RoomParticipant.prototype, "role", void 0);
_ts_decorate([
    (0, _typeorm.CreateDateColumn)({
        name: 'joined_at',
        type: 'datetime'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], RoomParticipant.prototype, "joinedAt", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'left_at',
        type: 'datetime',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], RoomParticipant.prototype, "leftAt", void 0);
RoomParticipant = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'room_participants'
    })
], RoomParticipant);
