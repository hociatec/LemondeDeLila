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
exports.VaultRoomSnapshotEntity = void 0;
const typeorm_1 = require("typeorm");
let VaultRoomSnapshotEntity = class VaultRoomSnapshotEntity {
    id;
    ownerUserId;
    name;
    gameType;
    roomName;
    playersLabel;
    snapshotJson;
    createdAt;
};
exports.VaultRoomSnapshotEntity = VaultRoomSnapshotEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], VaultRoomSnapshotEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'owner_user_id', type: 'int' }),
    __metadata("design:type", Number)
], VaultRoomSnapshotEntity.prototype, "ownerUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], VaultRoomSnapshotEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'game_type', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], VaultRoomSnapshotEntity.prototype, "gameType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'room_name', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], VaultRoomSnapshotEntity.prototype, "roomName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'players_label', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], VaultRoomSnapshotEntity.prototype, "playersLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'snapshot_json', type: 'longtext' }),
    __metadata("design:type", String)
], VaultRoomSnapshotEntity.prototype, "snapshotJson", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'datetime' }),
    __metadata("design:type", Date)
], VaultRoomSnapshotEntity.prototype, "createdAt", void 0);
exports.VaultRoomSnapshotEntity = VaultRoomSnapshotEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'vault_room_snapshots' }),
    (0, typeorm_1.Index)('idx_vault_room_snapshots_owner_created_at', [
        'ownerUserId',
        'createdAt',
    ])
], VaultRoomSnapshotEntity);
//# sourceMappingURL=vault-room-snapshot.entity.js.map