"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BugReportsService", {
    enumerable: true,
    get: function() {
        return BugReportsService;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _crypto = require("crypto");
const _bugreportentity = require("./entities/bug-report.entity");
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
function normalizeBugReportStatus(status) {
    // legacy alias
    if (status === 'rejected') return 'refused';
    return status;
}
function normalizeBugReportEntityStatus(report) {
    report.status = normalizeBugReportStatus(report.status);
    return report;
}
let BugReportsService = class BugReportsService {
    async list() {
        const items = await this.repo.find({
            order: {
                createdAt: 'DESC'
            }
        });
        return items.map(normalizeBugReportEntityStatus);
    }
    async get(id) {
        const key = (id || '').trim();
        if (!key) return null;
        const report = await this.repo.findOne({
            where: {
                id: key
            }
        });
        if (!report) return null;
        return normalizeBugReportEntityStatus(report);
    }
    async create(input) {
        const now = new Date();
        const entity = this.repo.create({
            id: (0, _crypto.randomUUID)(),
            subject: (input.subject || '').trim(),
            content: (input.content || '').trim(),
            status: 'pending',
            createdByUserId: Number(input.createdByUserId || 0),
            createdByUsername: (input.createdByUsername || '').trim() || 'admin',
            createdAt: now,
            updatedAt: now
        });
        return this.repo.save(entity);
    }
    async update(id, patch) {
        const current = await this.get(id);
        if (!current) return null;
        if (typeof patch.subject === 'string') {
            current.subject = patch.subject.trim();
        }
        if (typeof patch.content === 'string') {
            current.content = patch.content.trim();
        }
        return this.repo.save(current);
    }
    async updateStatus(id, status) {
        const current = await this.get(id);
        if (!current) return null;
        current.status = normalizeBugReportStatus(status);
        return this.repo.save(current);
    }
    async delete(id) {
        const key = (id || '').trim();
        if (!key) return false;
        const res = await this.repo.delete({
            id: key
        });
        return Boolean(res.affected && res.affected > 0);
    }
    constructor(repo){
        this.repo = repo;
    }
};
BugReportsService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(0, (0, _typeorm.InjectRepository)(_bugreportentity.BugReportEntity)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], BugReportsService);
