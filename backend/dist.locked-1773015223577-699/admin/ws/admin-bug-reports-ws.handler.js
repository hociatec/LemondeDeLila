"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminBugReportsWsHandler", {
    enumerable: true,
    get: function() {
        return AdminBugReportsWsHandler;
    }
});
const _common = require("@nestjs/common");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _bugreportsservice = require("../../bug-reports/bug-reports.service");
const _bugreportcommentsservice = require("../../bug-reports/bug-report-comments.service");
const _adminbugreportsdto = require("./admin-bug-reports.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AdminBugReportsWsHandler = class AdminBugReportsWsHandler {
    async create(session, payload) {
        const user = (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminbugreportsdto.AdminBugReportCreateWsDto, payload);
        const report = await this.reports.create({
            subject: dto.subject,
            content: dto.content,
            createdByUserId: user.id,
            createdByUsername: user.username
        });
        return {
            type: 'admin.bugReports.create',
            payload: {
                report
            }
        };
    }
    async list(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        this.validator.validate(_adminbugreportsdto.AdminBugReportsListWsDto, payload ?? {});
        const items = await this.reports.list();
        const counts = await this.comments.countByReportIds(items.map((r)=>r.id));
        const withCounts = items.map((r)=>({
                ...r,
                commentsCount: counts[r.id] ?? 0
            }));
        return {
            type: 'admin.bugReports.list',
            payload: {
                items: withCounts
            }
        };
    }
    async get(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminbugreportsdto.AdminBugReportIdWsDto, payload);
        const report = await this.reports.get(dto.id);
        if (!report) {
            throw new _common.BadRequestException('Rapport introuvable');
        }
        const counts = await this.comments.countByReportIds([
            report.id
        ]);
        return {
            type: 'admin.bugReports.get',
            payload: {
                report: {
                    ...report,
                    commentsCount: counts[report.id] ?? 0
                }
            }
        };
    }
    async update(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminbugreportsdto.AdminBugReportUpdateWsDto, payload);
        const report = await this.reports.update(dto.id, {
            subject: dto.subject,
            content: dto.content
        });
        if (!report) {
            throw new _common.BadRequestException('Rapport introuvable');
        }
        return {
            type: 'admin.bugReports.update',
            payload: {
                report
            }
        };
    }
    async updateStatus(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminbugreportsdto.AdminBugReportUpdateStatusWsDto, payload);
        const report = await this.reports.updateStatus(dto.id, dto.status);
        if (!report) {
            throw new _common.BadRequestException('Rapport introuvable');
        }
        return {
            type: 'admin.bugReports.updateStatus',
            payload: {
                report
            }
        };
    }
    async delete(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminbugreportsdto.AdminBugReportIdWsDto, payload);
        const ok = await this.reports.delete(dto.id);
        if (!ok) {
            throw new _common.BadRequestException('Rapport introuvable');
        }
        return {
            type: 'admin.bugReports.delete',
            payload: {
                removed: true
            }
        };
    }
    constructor(validator, reports, comments){
        this.validator = validator;
        this.reports = reports;
        this.comments = comments;
    }
};
AdminBugReportsWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _bugreportsservice.BugReportsService === "undefined" ? Object : _bugreportsservice.BugReportsService,
        typeof _bugreportcommentsservice.BugReportCommentsService === "undefined" ? Object : _bugreportcommentsservice.BugReportCommentsService
    ])
], AdminBugReportsWsHandler);
