"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get AdminMnemoQuizCategoriesListWsDto () {
        return AdminMnemoQuizCategoriesListWsDto;
    },
    get AdminMnemoQuizCategoryCreateWsDto () {
        return AdminMnemoQuizCategoryCreateWsDto;
    },
    get AdminMnemoQuizCategoryDeleteWsDto () {
        return AdminMnemoQuizCategoryDeleteWsDto;
    },
    get AdminMnemoQuizCategoryUpdateWsDto () {
        return AdminMnemoQuizCategoryUpdateWsDto;
    },
    get AdminMnemoQuizQuestionCreateWsDto () {
        return AdminMnemoQuizQuestionCreateWsDto;
    },
    get AdminMnemoQuizQuestionDeleteWsDto () {
        return AdminMnemoQuizQuestionDeleteWsDto;
    },
    get AdminMnemoQuizQuestionUpdateWsDto () {
        return AdminMnemoQuizQuestionUpdateWsDto;
    },
    get AdminMnemoQuizQuestionsListWsDto () {
        return AdminMnemoQuizQuestionsListWsDto;
    }
});
const _classvalidator = require("class-validator");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AdminMnemoQuizCategoriesListWsDto = class AdminMnemoQuizCategoriesListWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    _ts_metadata("design:type", String)
], AdminMnemoQuizCategoriesListWsDto.prototype, "_noop", void 0);
let AdminMnemoQuizCategoryCreateWsDto = class AdminMnemoQuizCategoryCreateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(120),
    _ts_metadata("design:type", String)
], AdminMnemoQuizCategoryCreateWsDto.prototype, "name", void 0);
let AdminMnemoQuizCategoryUpdateWsDto = class AdminMnemoQuizCategoryUpdateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(120),
    _ts_metadata("design:type", String)
], AdminMnemoQuizCategoryUpdateWsDto.prototype, "id", void 0);
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(120),
    _ts_metadata("design:type", String)
], AdminMnemoQuizCategoryUpdateWsDto.prototype, "name", void 0);
let AdminMnemoQuizCategoryDeleteWsDto = class AdminMnemoQuizCategoryDeleteWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(120),
    _ts_metadata("design:type", String)
], AdminMnemoQuizCategoryDeleteWsDto.prototype, "id", void 0);
let AdminMnemoQuizQuestionsListWsDto = class AdminMnemoQuizQuestionsListWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(120),
    _ts_metadata("design:type", String)
], AdminMnemoQuizQuestionsListWsDto.prototype, "categoryId", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsIn)([
        'validated',
        'pending',
        'to_edit',
        'trash'
    ]),
    _ts_metadata("design:type", String)
], AdminMnemoQuizQuestionsListWsDto.prototype, "status", void 0);
let AdminMnemoQuizQuestionCreateWsDto = class AdminMnemoQuizQuestionCreateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(120),
    _ts_metadata("design:type", String)
], AdminMnemoQuizQuestionCreateWsDto.prototype, "categoryId", void 0);
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(800),
    _ts_metadata("design:type", String)
], AdminMnemoQuizQuestionCreateWsDto.prototype, "question", void 0);
_ts_decorate([
    (0, _classvalidator.IsArray)(),
    (0, _classvalidator.ArrayMinSize)(4),
    (0, _classvalidator.ArrayMaxSize)(4),
    (0, _classvalidator.IsString)({
        each: true
    }),
    (0, _classvalidator.MinLength)(1, {
        each: true
    }),
    (0, _classvalidator.MaxLength)(200, {
        each: true
    }),
    _ts_metadata("design:type", Array)
], AdminMnemoQuizQuestionCreateWsDto.prototype, "answers", void 0);
_ts_decorate([
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(0),
    (0, _classvalidator.Max)(3),
    _ts_metadata("design:type", Number)
], AdminMnemoQuizQuestionCreateWsDto.prototype, "correctIndex", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsIn)([
        'validated',
        'pending',
        'to_edit',
        'trash'
    ]),
    _ts_metadata("design:type", String)
], AdminMnemoQuizQuestionCreateWsDto.prototype, "status", void 0);
let AdminMnemoQuizQuestionUpdateWsDto = class AdminMnemoQuizQuestionUpdateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(64),
    _ts_metadata("design:type", String)
], AdminMnemoQuizQuestionUpdateWsDto.prototype, "id", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(120),
    _ts_metadata("design:type", String)
], AdminMnemoQuizQuestionUpdateWsDto.prototype, "categoryId", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(800),
    _ts_metadata("design:type", String)
], AdminMnemoQuizQuestionUpdateWsDto.prototype, "question", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsArray)(),
    (0, _classvalidator.ArrayMinSize)(4),
    (0, _classvalidator.ArrayMaxSize)(4),
    (0, _classvalidator.IsString)({
        each: true
    }),
    (0, _classvalidator.MinLength)(1, {
        each: true
    }),
    (0, _classvalidator.MaxLength)(200, {
        each: true
    }),
    _ts_metadata("design:type", Array)
], AdminMnemoQuizQuestionUpdateWsDto.prototype, "answers", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(0),
    (0, _classvalidator.Max)(3),
    _ts_metadata("design:type", Number)
], AdminMnemoQuizQuestionUpdateWsDto.prototype, "correctIndex", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsIn)([
        'validated',
        'pending',
        'to_edit',
        'trash'
    ]),
    _ts_metadata("design:type", String)
], AdminMnemoQuizQuestionUpdateWsDto.prototype, "status", void 0);
let AdminMnemoQuizQuestionDeleteWsDto = class AdminMnemoQuizQuestionDeleteWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(64),
    _ts_metadata("design:type", String)
], AdminMnemoQuizQuestionDeleteWsDto.prototype, "id", void 0);
