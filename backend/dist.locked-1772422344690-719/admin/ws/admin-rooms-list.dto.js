"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminRoomsListWsDto", {
    enumerable: true,
    get: function() {
        return AdminRoomsListWsDto;
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
let AdminRoomsListWsDto = class AdminRoomsListWsDto {
};
_ts_decorate([
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    (0, _classvalidator.IsOptional)(),
    _ts_metadata("design:type", Number)
], AdminRoomsListWsDto.prototype, "limit", void 0);
_ts_decorate([
    (0, _classvalidator.IsBoolean)(),
    (0, _classvalidator.IsOptional)(),
    _ts_metadata("design:type", Boolean)
], AdminRoomsListWsDto.prototype, "includePrivate", void 0);
_ts_decorate([
    (0, _classvalidator.IsBoolean)(),
    (0, _classvalidator.IsOptional)(),
    _ts_metadata("design:type", Boolean)
], AdminRoomsListWsDto.prototype, "includeStarted", void 0);
_ts_decorate([
    (0, _classvalidator.IsBoolean)(),
    (0, _classvalidator.IsOptional)(),
    _ts_metadata("design:type", Boolean)
], AdminRoomsListWsDto.prototype, "joinableOnly", void 0);
