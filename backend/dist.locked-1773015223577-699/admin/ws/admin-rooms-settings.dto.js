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
    get AdminRoomsSettingsGetWsDto () {
        return AdminRoomsSettingsGetWsDto;
    },
    get AdminRoomsSettingsUpdateWsDto () {
        return AdminRoomsSettingsUpdateWsDto;
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
let AdminRoomsSettingsGetWsDto = class AdminRoomsSettingsGetWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminRoomsSettingsGetWsDto.prototype, "_noop", void 0);
let AdminRoomsSettingsUpdateWsDto = class AdminRoomsSettingsUpdateWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsBoolean)(),
    _ts_metadata("design:type", Boolean)
], AdminRoomsSettingsUpdateWsDto.prototype, "autoCleanupEnabled", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(5),
    (0, _classvalidator.Max)(24 * 60),
    _ts_metadata("design:type", Number)
], AdminRoomsSettingsUpdateWsDto.prototype, "autoCleanupOlderThanMinutes", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(30),
    (0, _classvalidator.Max)(24 * 60 * 60),
    _ts_metadata("design:type", Number)
], AdminRoomsSettingsUpdateWsDto.prototype, "autoCleanupIntervalSeconds", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    (0, _classvalidator.Max)(5000),
    _ts_metadata("design:type", Number)
], AdminRoomsSettingsUpdateWsDto.prototype, "autoCleanupLimit", void 0);
