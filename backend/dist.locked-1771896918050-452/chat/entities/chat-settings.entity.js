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
exports.ChatSettingsEntity = void 0;
const typeorm_1 = require("typeorm");
let ChatSettingsEntity = class ChatSettingsEntity {
    id;
    chatHistoryLimit;
    editWindowSeconds;
};
exports.ChatSettingsEntity = ChatSettingsEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'tinyint' }),
    __metadata("design:type", Number)
], ChatSettingsEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'chat_history_limit', type: 'int', default: 200 }),
    __metadata("design:type", Number)
], ChatSettingsEntity.prototype, "chatHistoryLimit", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'edit_window_seconds', type: 'int', default: 300 }),
    __metadata("design:type", Number)
], ChatSettingsEntity.prototype, "editWindowSeconds", void 0);
exports.ChatSettingsEntity = ChatSettingsEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'chat_settings' })
], ChatSettingsEntity);
//# sourceMappingURL=chat-settings.entity.js.map