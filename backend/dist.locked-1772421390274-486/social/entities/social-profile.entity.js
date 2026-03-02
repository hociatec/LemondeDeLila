"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SocialProfile", {
    enumerable: true,
    get: function() {
        return SocialProfile;
    }
});
const _typeorm = require("typeorm");
const _userentity = require("../../user/entities/user.entity");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let SocialProfile = class SocialProfile {
};
_ts_decorate([
    (0, _typeorm.PrimaryColumn)({
        name: 'user_id',
        type: 'int'
    }),
    _ts_metadata("design:type", Number)
], SocialProfile.prototype, "userId", void 0);
_ts_decorate([
    (0, _typeorm.OneToOne)(()=>_userentity.User, {
        eager: true,
        onDelete: 'CASCADE'
    }),
    (0, _typeorm.JoinColumn)({
        name: 'user_id'
    }),
    _ts_metadata("design:type", typeof _userentity.User === "undefined" ? Object : _userentity.User)
], SocialProfile.prototype, "user", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'longtext',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], SocialProfile.prototype, "bio", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 20,
        default: 'public'
    }),
    _ts_metadata("design:type", typeof SocialProfileVisibility === "undefined" ? Object : SocialProfileVisibility)
], SocialProfile.prototype, "visibility", void 0);
_ts_decorate([
    (0, _typeorm.CreateDateColumn)({
        name: 'created_at',
        type: 'datetime'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], SocialProfile.prototype, "createdAt", void 0);
_ts_decorate([
    (0, _typeorm.UpdateDateColumn)({
        name: 'updated_at',
        type: 'datetime'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], SocialProfile.prototype, "updatedAt", void 0);
SocialProfile = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'social_profiles'
    })
], SocialProfile);
