"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BugReportCommentEntity = void 0;
const typeorm_1 = require("typeorm");
let BugReportCommentEntity = class BugReportCommentEntity {
    id;
    reportId;
    content;
    createdAt;
    createdByUserId;
    createdByUsername;
};
exports.BugReportCommentEntity = BugReportCommentEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], BugReportCommentEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'report_id', type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], BugReportCommentEntity.prototype, "reportId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'longtext' }),
    __metadata("design:type", String)
], BugReportCommentEntity.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'datetime' }),
    __metadata("design:type", Date)
], BugReportCommentEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by_user_id', type: 'int' }),
    __metadata("design:type", Number)
], BugReportCommentEntity.prototype, "createdByUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by_username', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], BugReportCommentEntity.prototype, "createdByUsername", void 0);
exports.BugReportCommentEntity = BugReportCommentEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'bug_report_comments' }),
    (0, typeorm_1.Index)('idx_bug_report_comments_report_id', ['reportId']),
    (0, typeorm_1.Index)('idx_bug_report_comments_created_at', ['createdAt'])
], BugReportCommentEntity);
//# sourceMappingURL=bug-report-comment.entity.js.map