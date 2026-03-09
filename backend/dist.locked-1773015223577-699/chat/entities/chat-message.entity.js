"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ChatMessage", {
    enumerable: true,
    get: function() {
        return ChatMessage;
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
let ChatMessage = class ChatMessage {
    constructor(){
        this.deletedAt = null;
    }
};
_ts_decorate([
    (0, _typeorm.PrimaryGeneratedColumn)(),
    _ts_metadata("design:type", Number)
], ChatMessage.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.ManyToOne)(()=>_userentity.User, {
        onDelete: 'CASCADE',
        eager: true
    }),
    (0, _typeorm.JoinColumn)({
        name: 'user_id'
    }),
    _ts_metadata("design:type", typeof _userentity.User === "undefined" ? Object : _userentity.User)
], ChatMessage.prototype, "user", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'message_id',
        type: 'varchar',
        length: 36,
        unique: true
    }),
    _ts_metadata("design:type", String)
], ChatMessage.prototype, "messageId", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'longtext'
    }),
    _ts_metadata("design:type", String)
], ChatMessage.prototype, "message", void 0);
_ts_decorate([
    (0, _typeorm.CreateDateColumn)({
        name: 'created_at',
        type: 'datetime'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], ChatMessage.prototype, "createdAt", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'deleted_at',
        type: 'datetime',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], ChatMessage.prototype, "deletedAt", void 0);
ChatMessage = _ts_decorate([
    (0, _typeorm.Index)('idx_chat_messages_created_at', [
        'createdAt'
    ]),
    (0, _typeorm.Entity)({
        name: 'chat_messages'
    })
], ChatMessage);
