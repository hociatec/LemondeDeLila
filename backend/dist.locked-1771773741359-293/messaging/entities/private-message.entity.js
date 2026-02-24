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
exports.PrivateMessage = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../user/entities/user.entity");
let PrivateMessage = class PrivateMessage {
    id;
    sender;
    recipient;
    messageId;
    message;
    subject;
    createdAt;
    deletedBySenderAt;
    deletedByRecipientAt;
    readByRecipientAt;
};
exports.PrivateMessage = PrivateMessage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PrivateMessage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: true, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'sender_id' }),
    __metadata("design:type", user_entity_1.User)
], PrivateMessage.prototype, "sender", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: true, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'recipient_id' }),
    __metadata("design:type", user_entity_1.User)
], PrivateMessage.prototype, "recipient", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'message_id', type: 'varchar', length: 36, unique: true }),
    __metadata("design:type", String)
], PrivateMessage.prototype, "messageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], PrivateMessage.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], PrivateMessage.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'datetime' }),
    __metadata("design:type", Date)
], PrivateMessage.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deleted_by_sender_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], PrivateMessage.prototype, "deletedBySenderAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deleted_by_recipient_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], PrivateMessage.prototype, "deletedByRecipientAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'read_by_recipient_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], PrivateMessage.prototype, "readByRecipientAt", void 0);
exports.PrivateMessage = PrivateMessage = __decorate([
    (0, typeorm_1.Entity)({ name: 'messaging_private_messages' }),
    (0, typeorm_1.Unique)('uniq_messaging_private_messages_message_id', ['messageId']),
    (0, typeorm_1.Index)('idx_messaging_private_messages_created_at', ['createdAt']),
    (0, typeorm_1.Index)('idx_messaging_private_messages_sender', ['sender']),
    (0, typeorm_1.Index)('idx_messaging_private_messages_recipient', ['recipient'])
], PrivateMessage);
//# sourceMappingURL=private-message.entity.js.map