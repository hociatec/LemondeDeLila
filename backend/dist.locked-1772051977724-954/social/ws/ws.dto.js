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
    get SocialProfileGetDto () {
        return SocialProfileGetDto;
    },
    get SocialProfileUpdateDto () {
        return SocialProfileUpdateDto;
    },
    get SocialRequestListDto () {
        return SocialRequestListDto;
    },
    get SocialSearchDto () {
        return SocialSearchDto;
    },
    get SocialUserIdDto () {
        return SocialUserIdDto;
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
let SocialUserIdDto = class SocialUserIdDto {
};
_ts_decorate([
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.IsPositive)(),
    _ts_metadata("design:type", Number)
], SocialUserIdDto.prototype, "userId", void 0);
let SocialRequestListDto = class SocialRequestListDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsIn)([
        'incoming',
        'outgoing',
        'all'
    ]),
    _ts_metadata("design:type", String)
], SocialRequestListDto.prototype, "direction", void 0);
let SocialProfileGetDto = class SocialProfileGetDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.IsPositive)(),
    _ts_metadata("design:type", Number)
], SocialProfileGetDto.prototype, "userId", void 0);
let SocialProfileUpdateDto = class SocialProfileUpdateDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(100000),
    _ts_metadata("design:type", String)
], SocialProfileUpdateDto.prototype, "bio", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.IsIn)([
        'public',
        'friends',
        'private'
    ]),
    _ts_metadata("design:type", String)
], SocialProfileUpdateDto.prototype, "visibility", void 0);
let SocialSearchDto = class SocialSearchDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(100),
    _ts_metadata("design:type", String)
], SocialSearchDto.prototype, "query", void 0);
