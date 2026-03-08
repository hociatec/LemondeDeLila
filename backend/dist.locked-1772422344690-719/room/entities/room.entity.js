"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Room", {
    enumerable: true,
    get: function() {
        return Room;
    }
});
const _typeorm = require("typeorm");
const _userentity = require("../../user/entities/user.entity");
const _roomparticipantentity = require("./room-participant.entity");
const _roombotentity = require("./room-bot.entity");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let Room = class Room {
};
_ts_decorate([
    (0, _typeorm.PrimaryGeneratedColumn)(),
    _ts_metadata("design:type", Number)
], Room.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 255
    }),
    _ts_metadata("design:type", String)
], Room.prototype, "name", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'game_type',
        type: 'varchar',
        length: 100
    }),
    _ts_metadata("design:type", String)
], Room.prototype, "gameType", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'max_players',
        type: 'int',
        default: 4
    }),
    _ts_metadata("design:type", Number)
], Room.prototype, "maxPlayers", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'is_private',
        type: 'boolean',
        default: false
    }),
    _ts_metadata("design:type", Boolean)
], Room.prototype, "isPrivate", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 50,
        default: 'setup'
    }),
    _ts_metadata("design:type", String)
], Room.prototype, "status", void 0);
_ts_decorate([
    (0, _typeorm.ManyToOne)(()=>_userentity.User, {
        eager: true,
        nullable: true
    }),
    (0, _typeorm.JoinColumn)({
        name: 'owner_id'
    }),
    _ts_metadata("design:type", Object)
], Room.prototype, "owner", void 0);
_ts_decorate([
    (0, _typeorm.CreateDateColumn)({
        name: 'created_at',
        type: 'datetime'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], Room.prototype, "createdAt", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'started_at',
        type: 'datetime',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Room.prototype, "startedAt", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'run_id',
        type: 'int',
        default: 0
    }),
    _ts_metadata("design:type", Number)
], Room.prototype, "runId", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'table_ambience_sound_id',
        type: 'varchar',
        length: 50,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Room.prototype, "tableAmbienceSoundId", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'restored_from_snapshot_id',
        type: 'varchar',
        length: 64,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Room.prototype, "restoredFromSnapshotId", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'restored_owner_user_id',
        type: 'int',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Room.prototype, "restoredOwnerUserId", void 0);
_ts_decorate([
    (0, _typeorm.OneToMany)(()=>_roomparticipantentity.RoomParticipant, (p)=>p.room),
    _ts_metadata("design:type", Array)
], Room.prototype, "participants", void 0);
_ts_decorate([
    (0, _typeorm.OneToMany)(()=>_roombotentity.RoomBot, (b)=>b.room),
    _ts_metadata("design:type", Array)
], Room.prototype, "bots", void 0);
Room = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'rooms'
    })
], Room);
