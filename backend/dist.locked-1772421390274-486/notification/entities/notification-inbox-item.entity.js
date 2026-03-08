"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "NotificationInboxItem", {
    enumerable: true,
    get: function() {
        return NotificationInboxItem;
    }
});
const _typeorm = require("typeorm");
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
let NotificationInboxItem = class NotificationInboxItem {
};
_ts_decorate([
    (0, _typeorm.PrimaryColumn)({
        type: 'varchar',
        length: 36
    }),
    _ts_metadata("design:type", String)
], NotificationInboxItem.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.ManyToOne)(()=>_userentity.User, {
        eager: false,
        onDelete: 'CASCADE'
    }),
    (0, _typeorm.JoinColumn)({
        name: 'user_id'
    }),
    _ts_metadata("design:type", typeof _userentity.User === "undefined" ? Object : _userentity.User)
], NotificationInboxItem.prototype, "user", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 50
    }),
    _ts_metadata("design:type", String)
], NotificationInboxItem.prototype, "kind", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'contact_id',
        type: 'varchar',
        length: 36,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], NotificationInboxItem.prototype, "contactId", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'from_user_id',
        type: 'int',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], NotificationInboxItem.prototype, "fromUserId", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'from_username',
        type: 'varchar',
        length: 100,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], NotificationInboxItem.prototype, "fromUsername", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'to_user_id',
        type: 'int',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], NotificationInboxItem.prototype, "toUserId", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'text',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], NotificationInboxItem.prototype, "message", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'json',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], NotificationInboxItem.prototype, "payload", void 0);
_ts_decorate([
    (0, _typeorm.CreateDateColumn)({
        name: 'created_at',
        type: 'datetime'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], NotificationInboxItem.prototype, "createdAt", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'read_at',
        type: 'datetime',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], NotificationInboxItem.prototype, "readAt", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'deleted_at',
        type: 'datetime',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], NotificationInboxItem.prototype, "deletedAt", void 0);
NotificationInboxItem = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'notification_inbox_items'
    }),
    (0, _typeorm.Index)('idx_notification_inbox_user_created', [
        'user',
        'createdAt'
    ]),
    (0, _typeorm.Index)('idx_notification_inbox_user_unread', [
        'user',
        'readAt'
    ]),
    (0, _typeorm.Index)('idx_notification_inbox_user_deleted', [
        'user',
        'deletedAt'
    ])
], NotificationInboxItem);
