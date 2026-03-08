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
    get AdminBugReportCreateWsDto () {
        return AdminBugReportCreateWsDto;
    },
    get AdminBugReportIdWsDto () {
        return AdminBugReportIdWsDto;
    },
    get AdminBugReportUpdateStatusWsDto () {
        return AdminBugReportUpdateStatusWsDto;
    },
    get AdminBugReportUpdateWsDto () {
        return AdminBugReportUpdateWsDto;
    },
    get AdminBugReportsListWsDto () {
        return AdminBugReportsListWsDto;
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
let AdminBugReportCreateWsDto = class AdminBugReportCreateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(200),
    _ts_metadata("design:type", String)
], AdminBugReportCreateWsDto.prototype, "subject", void 0);
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(50000),
    _ts_metadata("design:type", String)
], AdminBugReportCreateWsDto.prototype, "content", void 0);
let AdminBugReportIdWsDto = class AdminBugReportIdWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(64),
    _ts_metadata("design:type", String)
], AdminBugReportIdWsDto.prototype, "id", void 0);
let AdminBugReportsListWsDto = class AdminBugReportsListWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    _ts_metadata("design:type", String)
], AdminBugReportsListWsDto.prototype, "_noop", void 0);
let AdminBugReportUpdateWsDto = class AdminBugReportUpdateWsDto extends AdminBugReportIdWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(200),
    _ts_metadata("design:type", String)
], AdminBugReportUpdateWsDto.prototype, "subject", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(50000),
    _ts_metadata("design:type", String)
], AdminBugReportUpdateWsDto.prototype, "content", void 0);
let AdminBugReportUpdateStatusWsDto = class AdminBugReportUpdateStatusWsDto extends AdminBugReportIdWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.IsIn)([
        'pending',
        'in_progress',
        'to_test',
        'done',
        'refused',
        'rejected'
    ]),
    _ts_metadata("design:type", String)
], AdminBugReportUpdateStatusWsDto.prototype, "status", void 0);
