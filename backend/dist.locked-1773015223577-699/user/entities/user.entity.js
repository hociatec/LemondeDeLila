"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "User", {
    enumerable: true,
    get: function() {
        return User;
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
let User = class User {
};
_ts_decorate([
    (0, _typeorm.PrimaryGeneratedColumn)(),
    _ts_metadata("design:type", Number)
], User.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        length: 180,
        unique: true
    }),
    _ts_metadata("design:type", String)
], User.prototype, "email", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'json'
    }),
    _ts_metadata("design:type", Array)
], User.prototype, "roles", void 0);
_ts_decorate([
    (0, _typeorm.Column)(),
    _ts_metadata("design:type", String)
], User.prototype, "password", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        length: 100,
        unique: true
    }),
    _ts_metadata("design:type", String)
], User.prototype, "username", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 255,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], User.prototype, "avatar", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'json',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], User.prototype, "preferences", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'email_verified',
        type: 'boolean',
        default: false
    }),
    _ts_metadata("design:type", Boolean)
], User.prototype, "emailVerified", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'banned_until',
        type: 'datetime',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], User.prototype, "bannedUntil", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'ban_reason',
        type: 'varchar',
        length: 255,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], User.prototype, "banReason", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'chat_banned_until',
        type: 'datetime',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], User.prototype, "chatBannedUntil", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'chat_ban_reason',
        type: 'varchar',
        length: 255,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], User.prototype, "chatBanReason", void 0);
_ts_decorate([
    (0, _typeorm.CreateDateColumn)({
        name: 'created_at',
        type: 'datetime'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], User.prototype, "createdAt", void 0);
User = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'users'
    })
], User);
