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
exports.SocialSearchDto = exports.SocialProfileUpdateDto = exports.SocialProfileGetDto = exports.SocialRequestListDto = exports.SocialUserIdDto = void 0;
const class_validator_1 = require("class-validator");
class SocialUserIdDto {
    userId;
}
exports.SocialUserIdDto = SocialUserIdDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], SocialUserIdDto.prototype, "userId", void 0);
class SocialRequestListDto {
    direction;
}
exports.SocialRequestListDto = SocialRequestListDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['incoming', 'outgoing', 'all']),
    __metadata("design:type", String)
], SocialRequestListDto.prototype, "direction", void 0);
class SocialProfileGetDto {
    userId;
}
exports.SocialProfileGetDto = SocialProfileGetDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], SocialProfileGetDto.prototype, "userId", void 0);
class SocialProfileUpdateDto {
    bio;
    visibility;
}
exports.SocialProfileUpdateDto = SocialProfileUpdateDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100000),
    __metadata("design:type", String)
], SocialProfileUpdateDto.prototype, "bio", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['public', 'friends', 'private']),
    __metadata("design:type", String)
], SocialProfileUpdateDto.prototype, "visibility", void 0);
class SocialSearchDto {
    query;
}
exports.SocialSearchDto = SocialSearchDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SocialSearchDto.prototype, "query", void 0);
//# sourceMappingURL=ws.dto.js.map