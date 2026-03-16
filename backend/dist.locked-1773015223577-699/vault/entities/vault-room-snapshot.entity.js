"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "VaultRoomSnapshotEntity", {
    enumerable: true,
    get: function() {
        return VaultRoomSnapshotEntity;
    }
});
const _typeorm = require("typeorm");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let VaultRoomSnapshotEntity = class VaultRoomSnapshotEntity {
};
_ts_decorate([
    (0, _typeorm.PrimaryColumn)({
        type: 'varchar',
        length: 36
    }),
    _ts_metadata("design:type", String)
], VaultRoomSnapshotEntity.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'owner_user_id',
        type: 'int'
    }),
    _ts_metadata("design:type", Number)
], VaultRoomSnapshotEntity.prototype, "ownerUserId", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 200
    }),
    _ts_metadata("design:type", String)
], VaultRoomSnapshotEntity.prototype, "name", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'game_type',
        type: 'varchar',
        length: 100
    }),
    _ts_metadata("design:type", String)
], VaultRoomSnapshotEntity.prototype, "gameType", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'room_name',
        type: 'varchar',
        length: 255
    }),
    _ts_metadata("design:type", String)
], VaultRoomSnapshotEntity.prototype, "roomName", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'players_label',
        type: 'varchar',
        length: 255
    }),
    _ts_metadata("design:type", String)
], VaultRoomSnapshotEntity.prototype, "playersLabel", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'snapshot_json',
        type: 'longtext'
    }),
    _ts_metadata("design:type", String)
], VaultRoomSnapshotEntity.prototype, "snapshotJson", void 0);
_ts_decorate([
    (0, _typeorm.CreateDateColumn)({
        name: 'created_at',
        type: 'datetime'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], VaultRoomSnapshotEntity.prototype, "createdAt", void 0);
VaultRoomSnapshotEntity = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'vault_room_snapshots'
    }),
    (0, _typeorm.Index)('idx_vault_room_snapshots_owner_created_at', [
        'ownerUserId',
        'createdAt'
    ])
], VaultRoomSnapshotEntity);
