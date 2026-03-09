"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BugReportCommentsService", {
    enumerable: true,
    get: function() {
        return BugReportCommentsService;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _crypto = require("crypto");
const _typeorm1 = require("typeorm");
const _bugreportentity = require("./entities/bug-report.entity");
const _bugreportcommententity = require("./entities/bug-report-comment.entity");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let BugReportCommentsService = class BugReportCommentsService {
    async countByReportIds(reportIds) {
        const ids = Array.from(new Set((reportIds ?? []).map((id)=>String(id ?? '').trim()).filter(Boolean)));
        if (ids.length === 0) return {};
        const rows = await this.repo.createQueryBuilder('c').select('c.reportId', 'reportId').addSelect('COUNT(*)', 'count').where('c.reportId IN (:...ids)', {
            ids
        }).groupBy('c.reportId').getRawMany();
        const out = {};
        for (const row of rows){
            const reportId = String(row.reportId ?? '').trim();
            if (!reportId) continue;
            const count = Number(row.count ?? 0);
            out[reportId] = Number.isFinite(count) ? count : 0;
        }
        return out;
    }
    listByReportId(reportId) {
        const id = String(reportId ?? '').trim();
        if (!id) return Promise.resolve([]);
        return this.repo.find({
            where: {
                reportId: id
            },
            order: {
                createdAt: 'ASC'
            }
        });
    }
    async add(input) {
        const reportId = String(input.reportId ?? '').trim();
        if (!reportId) return null;
        const report = await this.reports.findOne({
            where: {
                id: reportId
            }
        });
        if (!report) return null;
        const now = new Date();
        const entity = this.repo.create({
            id: (0, _crypto.randomUUID)(),
            reportId,
            content: String(input.content ?? '').trim(),
            createdByUserId: Number(input.createdByUserId || 0),
            createdByUsername: String(input.createdByUsername ?? '').trim() || 'admin',
            createdAt: now
        });
        return this.repo.save(entity);
    }
    constructor(repo, reports){
        this.repo = repo;
        this.reports = reports;
    }
};
BugReportCommentsService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(0, (0, _typeorm.InjectRepository)(_bugreportcommententity.BugReportCommentEntity)),
    _ts_param(1, (0, _typeorm.InjectRepository)(_bugreportentity.BugReportEntity)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], BugReportCommentsService);
