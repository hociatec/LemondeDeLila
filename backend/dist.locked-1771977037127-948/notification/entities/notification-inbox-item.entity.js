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
exports.NotificationInboxItem = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../user/entities/user.entity");
let NotificationInboxItem = class NotificationInboxItem {
    id;
    user;
    kind;
    contactId;
    fromUserId;
    fromUsername;
    toUserId;
    message;
    payload;
    createdAt;
    readAt;
    deletedAt;
};
exports.NotificationInboxItem = NotificationInboxItem;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], NotificationInboxItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: false, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], NotificationInboxItem.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], NotificationInboxItem.prototype, "kind", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'contact_id', type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], NotificationInboxItem.prototype, "contactId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'from_user_id', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], NotificationInboxItem.prototype, "fromUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'from_username',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], NotificationInboxItem.prototype, "fromUsername", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'to_user_id', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], NotificationInboxItem.prototype, "toUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], NotificationInboxItem.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], NotificationInboxItem.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'datetime' }),
    __metadata("design:type", Date)
], NotificationInboxItem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'read_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], NotificationInboxItem.prototype, "readAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deleted_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], NotificationInboxItem.prototype, "deletedAt", void 0);
exports.NotificationInboxItem = NotificationInboxItem = __decorate([
    (0, typeorm_1.Entity)({ name: 'notification_inbox_items' }),
    (0, typeorm_1.Index)('idx_notification_inbox_user_created', ['user', 'createdAt']),
    (0, typeorm_1.Index)('idx_notification_inbox_user_unread', ['user', 'readAt']),
    (0, typeorm_1.Index)('idx_notification_inbox_user_deleted', ['user', 'deletedAt'])
], NotificationInboxItem);
//# sourceMappingURL=notification-inbox-item.entity.js.map