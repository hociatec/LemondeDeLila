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
exports.AdminBugReportUpdateStatusWsDto = exports.AdminBugReportUpdateWsDto = exports.AdminBugReportsListWsDto = exports.AdminBugReportIdWsDto = exports.AdminBugReportCreateWsDto = void 0;
const class_validator_1 = require("class-validator");
class AdminBugReportCreateWsDto {
    subject;
    content;
}
exports.AdminBugReportCreateWsDto = AdminBugReportCreateWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AdminBugReportCreateWsDto.prototype, "subject", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(50000),
    __metadata("design:type", String)
], AdminBugReportCreateWsDto.prototype, "content", void 0);
class AdminBugReportIdWsDto {
    id;
}
exports.AdminBugReportIdWsDto = AdminBugReportIdWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AdminBugReportIdWsDto.prototype, "id", void 0);
class AdminBugReportsListWsDto {
    _noop;
}
exports.AdminBugReportsListWsDto = AdminBugReportsListWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdminBugReportsListWsDto.prototype, "_noop", void 0);
class AdminBugReportUpdateWsDto extends AdminBugReportIdWsDto {
    subject;
    content;
}
exports.AdminBugReportUpdateWsDto = AdminBugReportUpdateWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AdminBugReportUpdateWsDto.prototype, "subject", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(50000),
    __metadata("design:type", String)
], AdminBugReportUpdateWsDto.prototype, "content", void 0);
class AdminBugReportUpdateStatusWsDto extends AdminBugReportIdWsDto {
    status;
}
exports.AdminBugReportUpdateStatusWsDto = AdminBugReportUpdateStatusWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['pending', 'in_progress', 'to_test', 'done', 'refused', 'rejected']),
    __metadata("design:type", String)
], AdminBugReportUpdateStatusWsDto.prototype, "status", void 0);
//# sourceMappingURL=admin-bug-reports.dto.js.map