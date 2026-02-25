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
exports.AdminRoomsSettingsUpdateWsDto = exports.AdminRoomsSettingsGetWsDto = void 0;
const class_validator_1 = require("class-validator");
class AdminRoomsSettingsGetWsDto {
    _noop;
}
exports.AdminRoomsSettingsGetWsDto = AdminRoomsSettingsGetWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminRoomsSettingsGetWsDto.prototype, "_noop", void 0);
class AdminRoomsSettingsUpdateWsDto {
    autoCleanupEnabled;
    autoCleanupOlderThanMinutes;
    autoCleanupIntervalSeconds;
    autoCleanupLimit;
}
exports.AdminRoomsSettingsUpdateWsDto = AdminRoomsSettingsUpdateWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AdminRoomsSettingsUpdateWsDto.prototype, "autoCleanupEnabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(5),
    (0, class_validator_1.Max)(24 * 60),
    __metadata("design:type", Number)
], AdminRoomsSettingsUpdateWsDto.prototype, "autoCleanupOlderThanMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(30),
    (0, class_validator_1.Max)(24 * 60 * 60),
    __metadata("design:type", Number)
], AdminRoomsSettingsUpdateWsDto.prototype, "autoCleanupIntervalSeconds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5000),
    __metadata("design:type", Number)
], AdminRoomsSettingsUpdateWsDto.prototype, "autoCleanupLimit", void 0);
//# sourceMappingURL=admin-rooms-settings.dto.js.map