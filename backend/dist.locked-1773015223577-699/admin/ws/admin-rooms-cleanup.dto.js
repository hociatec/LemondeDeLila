"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminRoomsCleanupWsDto", {
    enumerable: true,
    get: function() {
        return AdminRoomsCleanupWsDto;
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
let AdminRoomsCleanupWsDto = class AdminRoomsCleanupWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminRoomsCleanupWsDto.prototype, "confirm", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminRoomsCleanupWsDto.prototype, "includePrivate", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminRoomsCleanupWsDto.prototype, "includeStarted", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminRoomsCleanupWsDto.prototype, "dryRun", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(0),
    (0, _classvalidator.Max)(365 * 24 * 60),
    _ts_metadata("design:type", Number)
], AdminRoomsCleanupWsDto.prototype, "olderThanMinutes", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    (0, _classvalidator.Max)(5000),
    _ts_metadata("design:type", Number)
], AdminRoomsCleanupWsDto.prototype, "limit", void 0);
