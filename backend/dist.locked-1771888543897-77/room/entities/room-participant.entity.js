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
exports.RoomParticipant = void 0;
const typeorm_1 = require("typeorm");
const room_entity_1 = require("./room.entity");
const user_entity_1 = require("../../user/entities/user.entity");
let RoomParticipant = class RoomParticipant {
    id;
    room;
    user;
    role;
    joinedAt;
    leftAt;
};
exports.RoomParticipant = RoomParticipant;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], RoomParticipant.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => room_entity_1.Room, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'room_id' }),
    __metadata("design:type", room_entity_1.Room)
], RoomParticipant.prototype, "room", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: true, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], RoomParticipant.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'player' }),
    __metadata("design:type", String)
], RoomParticipant.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'joined_at', type: 'datetime' }),
    __metadata("design:type", Date)
], RoomParticipant.prototype, "joinedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'left_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], RoomParticipant.prototype, "leftAt", void 0);
exports.RoomParticipant = RoomParticipant = __decorate([
    (0, typeorm_1.Entity)({ name: 'room_participants' })
], RoomParticipant);
//# sourceMappingURL=room-participant.entity.js.map