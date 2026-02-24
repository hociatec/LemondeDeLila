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
exports.AdminMnemoQuizQuestionDeleteWsDto = exports.AdminMnemoQuizQuestionUpdateWsDto = exports.AdminMnemoQuizQuestionCreateWsDto = exports.AdminMnemoQuizQuestionsListWsDto = exports.AdminMnemoQuizCategoryDeleteWsDto = exports.AdminMnemoQuizCategoryUpdateWsDto = exports.AdminMnemoQuizCategoryCreateWsDto = exports.AdminMnemoQuizCategoriesListWsDto = void 0;
const class_validator_1 = require("class-validator");
class AdminMnemoQuizCategoriesListWsDto {
    _noop;
}
exports.AdminMnemoQuizCategoriesListWsDto = AdminMnemoQuizCategoriesListWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdminMnemoQuizCategoriesListWsDto.prototype, "_noop", void 0);
class AdminMnemoQuizCategoryCreateWsDto {
    name;
}
exports.AdminMnemoQuizCategoryCreateWsDto = AdminMnemoQuizCategoryCreateWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminMnemoQuizCategoryCreateWsDto.prototype, "name", void 0);
class AdminMnemoQuizCategoryUpdateWsDto {
    id;
    name;
}
exports.AdminMnemoQuizCategoryUpdateWsDto = AdminMnemoQuizCategoryUpdateWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminMnemoQuizCategoryUpdateWsDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminMnemoQuizCategoryUpdateWsDto.prototype, "name", void 0);
class AdminMnemoQuizCategoryDeleteWsDto {
    id;
}
exports.AdminMnemoQuizCategoryDeleteWsDto = AdminMnemoQuizCategoryDeleteWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminMnemoQuizCategoryDeleteWsDto.prototype, "id", void 0);
class AdminMnemoQuizQuestionsListWsDto {
    categoryId;
    status;
}
exports.AdminMnemoQuizQuestionsListWsDto = AdminMnemoQuizQuestionsListWsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminMnemoQuizQuestionsListWsDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['validated', 'pending', 'to_edit', 'trash']),
    __metadata("design:type", String)
], AdminMnemoQuizQuestionsListWsDto.prototype, "status", void 0);
class AdminMnemoQuizQuestionCreateWsDto {
    categoryId;
    question;
    answers;
    correctIndex;
    status;
}
exports.AdminMnemoQuizQuestionCreateWsDto = AdminMnemoQuizQuestionCreateWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminMnemoQuizQuestionCreateWsDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(800),
    __metadata("design:type", String)
], AdminMnemoQuizQuestionCreateWsDto.prototype, "question", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(4),
    (0, class_validator_1.ArrayMaxSize)(4),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MinLength)(1, { each: true }),
    (0, class_validator_1.MaxLength)(200, { each: true }),
    __metadata("design:type", Array)
], AdminMnemoQuizQuestionCreateWsDto.prototype, "answers", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(3),
    __metadata("design:type", Number)
], AdminMnemoQuizQuestionCreateWsDto.prototype, "correctIndex", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['validated', 'pending', 'to_edit', 'trash']),
    __metadata("design:type", String)
], AdminMnemoQuizQuestionCreateWsDto.prototype, "status", void 0);
class AdminMnemoQuizQuestionUpdateWsDto {
    id;
    categoryId;
    question;
    answers;
    correctIndex;
    status;
}
exports.AdminMnemoQuizQuestionUpdateWsDto = AdminMnemoQuizQuestionUpdateWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AdminMnemoQuizQuestionUpdateWsDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminMnemoQuizQuestionUpdateWsDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(800),
    __metadata("design:type", String)
], AdminMnemoQuizQuestionUpdateWsDto.prototype, "question", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(4),
    (0, class_validator_1.ArrayMaxSize)(4),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MinLength)(1, { each: true }),
    (0, class_validator_1.MaxLength)(200, { each: true }),
    __metadata("design:type", Array)
], AdminMnemoQuizQuestionUpdateWsDto.prototype, "answers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(3),
    __metadata("design:type", Number)
], AdminMnemoQuizQuestionUpdateWsDto.prototype, "correctIndex", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['validated', 'pending', 'to_edit', 'trash']),
    __metadata("design:type", String)
], AdminMnemoQuizQuestionUpdateWsDto.prototype, "status", void 0);
class AdminMnemoQuizQuestionDeleteWsDto {
    id;
}
exports.AdminMnemoQuizQuestionDeleteWsDto = AdminMnemoQuizQuestionDeleteWsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AdminMnemoQuizQuestionDeleteWsDto.prototype, "id", void 0);
//# sourceMappingURL=admin-mnemo-quiz.dto.js.map