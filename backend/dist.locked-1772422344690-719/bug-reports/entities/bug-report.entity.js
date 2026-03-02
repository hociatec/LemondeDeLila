"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BugReportEntity", {
    enumerable: true,
    get: function() {
        return BugReportEntity;
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
let BugReportEntity = class BugReportEntity {
};
_ts_decorate([
    (0, _typeorm.PrimaryColumn)({
        type: 'varchar',
        length: 36
    }),
    _ts_metadata("design:type", String)
], BugReportEntity.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 200
    }),
    _ts_metadata("design:type", String)
], BugReportEntity.prototype, "subject", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'longtext'
    }),
    _ts_metadata("design:type", String)
], BugReportEntity.prototype, "content", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 20,
        default: 'pending'
    }),
    _ts_metadata("design:type", typeof BugReportStatus === "undefined" ? Object : BugReportStatus)
], BugReportEntity.prototype, "status", void 0);
_ts_decorate([
    (0, _typeorm.CreateDateColumn)({
        name: 'created_at',
        type: 'datetime'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], BugReportEntity.prototype, "createdAt", void 0);
_ts_decorate([
    (0, _typeorm.UpdateDateColumn)({
        name: 'updated_at',
        type: 'datetime'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], BugReportEntity.prototype, "updatedAt", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'created_by_user_id',
        type: 'int'
    }),
    _ts_metadata("design:type", Number)
], BugReportEntity.prototype, "createdByUserId", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'created_by_username',
        type: 'varchar',
        length: 100
    }),
    _ts_metadata("design:type", String)
], BugReportEntity.prototype, "createdByUsername", void 0);
BugReportEntity = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'bug_reports'
    }),
    (0, _typeorm.Index)('idx_bug_reports_status', [
        'status'
    ]),
    (0, _typeorm.Index)('idx_bug_reports_created_at', [
        'createdAt'
    ])
], BugReportEntity);
