"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SocialProfileSettingsEntity", {
    enumerable: true,
    get: function() {
        return SocialProfileSettingsEntity;
    }
});
const _typeorm = require("typeorm");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let SocialProfileSettingsEntity = class SocialProfileSettingsEntity {
};
_ts_decorate([
    (0, _typeorm.PrimaryColumn)({
        type: 'tinyint'
    }),
    _ts_metadata("design:type", Number)
], SocialProfileSettingsEntity.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'bio_min_length',
        type: 'int',
        default: 0
    }),
    _ts_metadata("design:type", Number)
], SocialProfileSettingsEntity.prototype, "bioMinLength", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'bio_max_length',
        type: 'int',
        default: 500
    }),
    _ts_metadata("design:type", Number)
], SocialProfileSettingsEntity.prototype, "bioMaxLength", void 0);
SocialProfileSettingsEntity = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'social_profile_settings'
    })
], SocialProfileSettingsEntity);
