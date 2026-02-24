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
exports.BugReportsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const bug_report_entity_1 = require("./entities/bug-report.entity");
function normalizeBugReportStatus(status) {
    if (status === 'rejected')
        return 'refused';
    return status;
}
function normalizeBugReportEntityStatus(report) {
    report.status = normalizeBugReportStatus(report.status);
    return report;
}
let BugReportsService = class BugReportsService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async list() {
        const items = await this.repo.find({ order: { createdAt: 'DESC' } });
        return items.map(normalizeBugReportEntityStatus);
    }
    async get(id) {
        const key = (id || '').trim();
        if (!key)
            return null;
        const report = await this.repo.findOne({ where: { id: key } });
        if (!report)
            return null;
        return normalizeBugReportEntityStatus(report);
    }
    async create(input) {
        const now = new Date();
        const entity = this.repo.create({
            id: (0, crypto_1.randomUUID)(),
            subject: (input.subject || '').trim(),
            content: (input.content || '').trim(),
            status: 'pending',
            createdByUserId: Number(input.createdByUserId || 0),
            createdByUsername: (input.createdByUsername || '').trim() || 'admin',
            createdAt: now,
            updatedAt: now,
        });
        return this.repo.save(entity);
    }
    async update(id, patch) {
        const current = await this.get(id);
        if (!current)
            return null;
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
        if (!current)
            return null;
        current.status = normalizeBugReportStatus(status);
        return this.repo.save(current);
    }
    async delete(id) {
        const key = (id || '').trim();
        if (!key)
            return false;
        const res = await this.repo.delete({ id: key });
        return Boolean(res.affected && res.affected > 0);
    }
};
exports.BugReportsService = BugReportsService;
exports.BugReportsService = BugReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(bug_report_entity_1.BugReportEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], BugReportsService);
//# sourceMappingURL=bug-reports.service.js.map