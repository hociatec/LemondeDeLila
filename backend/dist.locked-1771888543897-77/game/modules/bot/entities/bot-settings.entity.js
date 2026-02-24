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
exports.BotSettingsEntity = void 0;
const typeorm_1 = require("typeorm");
let BotSettingsEntity = class BotSettingsEntity {
    id;
    botTurnDelayMs;
    botStartDelayMs;
    botDrawDelayMs;
};
exports.BotSettingsEntity = BotSettingsEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'tinyint' }),
    __metadata("design:type", Number)
], BotSettingsEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'bot_turn_delay_ms', type: 'int', default: 4000 }),
    __metadata("design:type", Number)
], BotSettingsEntity.prototype, "botTurnDelayMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'bot_start_delay_ms', type: 'int', default: 4000 }),
    __metadata("design:type", Number)
], BotSettingsEntity.prototype, "botStartDelayMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'bot_draw_delay_ms', type: 'int', default: 4000 }),
    __metadata("design:type", Number)
], BotSettingsEntity.prototype, "botDrawDelayMs", void 0);
exports.BotSettingsEntity = BotSettingsEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'bot_settings' })
], BotSettingsEntity);
//# sourceMappingURL=bot-settings.entity.js.map