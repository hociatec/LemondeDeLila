"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PrivateMessage", {
    enumerable: true,
    get: function() {
        return PrivateMessage;
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
let PrivateMessage = class PrivateMessage {
};
_ts_decorate([
    (0, _typeorm.PrimaryGeneratedColumn)(),
    _ts_metadata("design:type", Number)
], PrivateMessage.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.ManyToOne)(()=>_userentity.User, {
        eager: true,
        onDelete: 'CASCADE'
    }),
    (0, _typeorm.JoinColumn)({
        name: 'sender_id'
    }),
    _ts_metadata("design:type", typeof _userentity.User === "undefined" ? Object : _userentity.User)
], PrivateMessage.prototype, "sender", void 0);
_ts_decorate([
    (0, _typeorm.ManyToOne)(()=>_userentity.User, {
        eager: true,
        onDelete: 'CASCADE'
    }),
    (0, _typeorm.JoinColumn)({
        name: 'recipient_id'
    }),
    _ts_metadata("design:type", typeof _userentity.User === "undefined" ? Object : _userentity.User)
], PrivateMessage.prototype, "recipient", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'message_id',
        type: 'varchar',
        length: 36,
        unique: true
    }),
    _ts_metadata("design:type", String)
], PrivateMessage.prototype, "messageId", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'text'
    }),
    _ts_metadata("design:type", String)
], PrivateMessage.prototype, "message", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 200,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], PrivateMessage.prototype, "subject", void 0);
_ts_decorate([
    (0, _typeorm.CreateDateColumn)({
        name: 'created_at',
        type: 'datetime'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], PrivateMessage.prototype, "createdAt", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'deleted_by_sender_at',
        type: 'datetime',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], PrivateMessage.prototype, "deletedBySenderAt", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'deleted_by_recipient_at',
        type: 'datetime',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], PrivateMessage.prototype, "deletedByRecipientAt", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'read_by_recipient_at',
        type: 'datetime',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], PrivateMessage.prototype, "readByRecipientAt", void 0);
PrivateMessage = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'messaging_private_messages'
    }),
    (0, _typeorm.Unique)('uniq_messaging_private_messages_message_id', [
        'messageId'
    ]),
    (0, _typeorm.Index)('idx_messaging_private_messages_created_at', [
        'createdAt'
    ]),
    (0, _typeorm.Index)('idx_messaging_private_messages_sender', [
        'sender'
    ]),
    (0, _typeorm.Index)('idx_messaging_private_messages_recipient', [
        'recipient'
    ])
], PrivateMessage);
