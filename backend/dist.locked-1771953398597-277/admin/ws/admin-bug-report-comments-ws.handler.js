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
exports.AdminBugReportCommentsWsHandler = void 0;
const common_1 = require("@nestjs/common");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const bug_report_comments_service_1 = require("../../bug-reports/bug-report-comments.service");
const admin_bug_report_comments_dto_1 = require("./admin-bug-report-comments.dto");
let AdminBugReportCommentsWsHandler = class AdminBugReportCommentsWsHandler {
    validator;
    comments;
    constructor(validator, comments) {
        this.validator = validator;
        this.comments = comments;
    }
    async list(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_bug_report_comments_dto_1.AdminBugReportCommentsListWsDto, payload);
        const items = await this.comments.listByReportId(dto.reportId);
        return { type: 'admin.bugReports.comments.list', payload: { items } };
    }
    async add(session, payload) {
        const user = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_bug_report_comments_dto_1.AdminBugReportCommentAddWsDto, payload);
        const comment = await this.comments.add({
            reportId: dto.reportId,
            content: dto.content,
            createdByUserId: user.id,
            createdByUsername: user.username,
        });
        if (!comment) {
            throw new common_1.BadRequestException('Rapport introuvable');
        }
        const counts = await this.comments.countByReportIds([dto.reportId]);
        return {
            type: 'admin.bugReports.comments.add',
            payload: {
                comment,
                reportId: dto.reportId,
                commentsCount: counts[dto.reportId] ?? 0,
            },
        };
    }
};
exports.AdminBugReportCommentsWsHandler = AdminBugReportCommentsWsHandler;
exports.AdminBugReportCommentsWsHandler = AdminBugReportCommentsWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [payload_validation_service_1.PayloadValidationService,
        bug_report_comments_service_1.BugReportCommentsService])
], AdminBugReportCommentsWsHandler);
//# sourceMappingURL=admin-bug-report-comments-ws.handler.js.map