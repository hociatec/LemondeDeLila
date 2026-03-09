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
    get AdminBugReportCommentAddWsDto () {
        return AdminBugReportCommentAddWsDto;
    },
    get AdminBugReportCommentsListWsDto () {
        return AdminBugReportCommentsListWsDto;
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
let AdminBugReportCommentsListWsDto = class AdminBugReportCommentsListWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.Matches)(/\S/, {
        message: 'reportId must not be blank'
    }),
    (0, _classvalidator.MaxLength)(64),
    _ts_metadata("design:type", String)
], AdminBugReportCommentsListWsDto.prototype, "reportId", void 0);
let AdminBugReportCommentAddWsDto = class AdminBugReportCommentAddWsDto extends AdminBugReportCommentsListWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.Matches)(/\S/, {
        message: 'content must not be blank'
    }),
    (0, _classvalidator.MaxLength)(50000),
    _ts_metadata("design:type", String)
], AdminBugReportCommentAddWsDto.prototype, "content", void 0);
