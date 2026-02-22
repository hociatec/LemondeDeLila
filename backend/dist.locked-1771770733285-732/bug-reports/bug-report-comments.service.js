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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BugReportCommentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const bug_report_entity_1 = require("./entities/bug-report.entity");
const bug_report_comment_entity_1 = require("./entities/bug-report-comment.entity");
let BugReportCommentsService = class BugReportCommentsService {
    repo;
    reports;
    constructor(repo, reports) {
        this.repo = repo;
        this.reports = reports;
    }
    async countByReportIds(reportIds) {
        const ids = Array.from(new Set((reportIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean)));
        if (ids.length === 0)
            return {};
        const rows = await this.repo
            .createQueryBuilder('c')
            .select('c.reportId', 'reportId')
            .addSelect('COUNT(*)', 'count')
            .where('c.reportId IN (:...ids)', { ids })
            .groupBy('c.reportId')
            .getRawMany();
        const out = {};
        for (const row of rows) {
            const reportId = String(row.reportId ?? '').trim();
            if (!reportId)
                continue;
            const count = Number(row.count ?? 0);
            out[reportId] = Number.isFinite(count) ? count : 0;
        }
        return out;
    }
    listByReportId(reportId) {
        const id = String(reportId ?? '').trim();
        if (!id)
            return Promise.resolve([]);
        return this.repo.find({
            where: { reportId: id },
            order: { createdAt: 'ASC' },
        });
    }
    async add(input) {
        const reportId = String(input.reportId ?? '').trim();
        if (!reportId)
            return null;
        const report = await this.reports.findOne({ where: { id: reportId } });
        if (!report)
            return null;
        const now = new Date();
        const entity = this.repo.create({
            id: (0, crypto_1.randomUUID)(),
            reportId,
            content: String(input.content ?? '').trim(),
            createdByUserId: Number(input.createdByUserId || 0),
            createdByUsername: String(input.createdByUsername ?? '').trim() || 'admin',
            createdAt: now,
        });
        return this.repo.save(entity);
    }
};
exports.BugReportCommentsService = BugReportCommentsService;
exports.BugReportCommentsService = BugReportCommentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(bug_report_comment_entity_1.BugReportCommentEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(bug_report_entity_1.BugReportEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], BugReportCommentsService);
//# sourceMappingURL=bug-report-comments.service.js.map