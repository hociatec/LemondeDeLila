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
exports.AdminBugReportsWsHandler = void 0;
const common_1 = require("@nestjs/common");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const bug_reports_service_1 = require("../../bug-reports/bug-reports.service");
const bug_report_comments_service_1 = require("../../bug-reports/bug-report-comments.service");
const admin_bug_reports_dto_1 = require("./admin-bug-reports.dto");
let AdminBugReportsWsHandler = class AdminBugReportsWsHandler {
    validator;
    reports;
    comments;
    constructor(validator, reports, comments) {
        this.validator = validator;
        this.reports = reports;
        this.comments = comments;
    }
    async create(session, payload) {
        const user = (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_bug_reports_dto_1.AdminBugReportCreateWsDto, payload);
        const report = await this.reports.create({
            subject: dto.subject,
            content: dto.content,
            createdByUserId: user.id,
            createdByUsername: user.username,
        });
        return { type: 'admin.bugReports.create', payload: { report } };
    }
    async list(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        this.validator.validate(admin_bug_reports_dto_1.AdminBugReportsListWsDto, payload ?? {});
        const items = await this.reports.list();
        const counts = await this.comments.countByReportIds(items.map((r) => r.id));
        const withCounts = items.map((r) => ({
            ...r,
            commentsCount: counts[r.id] ?? 0,
        }));
        return { type: 'admin.bugReports.list', payload: { items: withCounts } };
    }
    async get(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_bug_reports_dto_1.AdminBugReportIdWsDto, payload);
        const report = await this.reports.get(dto.id);
        if (!report) {
            throw new common_1.BadRequestException('Rapport introuvable');
        }
        const counts = await this.comments.countByReportIds([report.id]);
        return {
            type: 'admin.bugReports.get',
            payload: {
                report: { ...report, commentsCount: counts[report.id] ?? 0 },
            },
        };
    }
    async update(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_bug_reports_dto_1.AdminBugReportUpdateWsDto, payload);
        const report = await this.reports.update(dto.id, {
            subject: dto.subject,
            content: dto.content,
        });
        if (!report) {
            throw new common_1.BadRequestException('Rapport introuvable');
        }
        return { type: 'admin.bugReports.update', payload: { report } };
    }
    async updateStatus(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_bug_reports_dto_1.AdminBugReportUpdateStatusWsDto, payload);
        const report = await this.reports.updateStatus(dto.id, dto.status);
        if (!report) {
            throw new common_1.BadRequestException('Rapport introuvable');
        }
        return { type: 'admin.bugReports.updateStatus', payload: { report } };
    }
    async delete(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_bug_reports_dto_1.AdminBugReportIdWsDto, payload);
        const ok = await this.reports.delete(dto.id);
        if (!ok) {
            throw new common_1.BadRequestException('Rapport introuvable');
        }
        return { type: 'admin.bugReports.delete', payload: { removed: true } };
    }
};
exports.AdminBugReportsWsHandler = AdminBugReportsWsHandler;
exports.AdminBugReportsWsHandler = AdminBugReportsWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [payload_validation_service_1.PayloadValidationService,
        bug_reports_service_1.BugReportsService,
        bug_report_comments_service_1.BugReportCommentsService])
], AdminBugReportsWsHandler);
//# sourceMappingURL=admin-bug-reports-ws.handler.js.map