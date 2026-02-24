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
exports.Room = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../user/entities/user.entity");
const room_participant_entity_1 = require("./room-participant.entity");
const room_bot_entity_1 = require("./room-bot.entity");
let Room = class Room {
    id;
    name;
    gameType;
    maxPlayers;
    isPrivate;
    status;
    owner;
    createdAt;
    startedAt;
    runId;
    tableAmbienceSoundId;
    restoredFromSnapshotId;
    restoredOwnerUserId;
    participants;
    bots;
};
exports.Room = Room;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Room.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Room.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'game_type', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], Room.prototype, "gameType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_players', type: 'int', default: 4 }),
    __metadata("design:type", Number)
], Room.prototype, "maxPlayers", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_private', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Room.prototype, "isPrivate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'setup' }),
    __metadata("design:type", String)
], Room.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: true, nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'owner_id' }),
    __metadata("design:type", Object)
], Room.prototype, "owner", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'datetime' }),
    __metadata("design:type", Date)
], Room.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'started_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], Room.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'run_id', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Room.prototype, "runId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'table_ambience_sound_id',
        type: 'varchar',
        length: 50,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Room.prototype, "tableAmbienceSoundId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'restored_from_snapshot_id',
        type: 'varchar',
        length: 64,
        nullable: true,
    }),
    __metadata("design:type", Object)
], Room.prototype, "restoredFromSnapshotId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'restored_owner_user_id', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], Room.prototype, "restoredOwnerUserId", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => room_participant_entity_1.RoomParticipant, (p) => p.room),
    __metadata("design:type", Array)
], Room.prototype, "participants", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => room_bot_entity_1.RoomBot, (b) => b.room),
    __metadata("design:type", Array)
], Room.prototype, "bots", void 0);
exports.Room = Room = __decorate([
    (0, typeorm_1.Entity)({ name: 'rooms' })
], Room);
//# sourceMappingURL=room.entity.js.map