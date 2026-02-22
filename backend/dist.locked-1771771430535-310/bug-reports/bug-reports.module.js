"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BugReportsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bug_report_entity_1 = require("./entities/bug-report.entity");
const bug_reports_service_1 = require("./bug-reports.service");
const bug_report_comment_entity_1 = require("./entities/bug-report-comment.entity");
const bug_report_comments_service_1 = require("./bug-report-comments.service");
let BugReportsModule = class BugReportsModule {
};
exports.BugReportsModule = BugReportsModule;
exports.BugReportsModule = BugReportsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([bug_report_entity_1.BugReportEntity, bug_report_comment_entity_1.BugReportCommentEntity]),
        ],
        providers: [bug_reports_service_1.BugReportsService, bug_report_comments_service_1.BugReportCommentsService],
        exports: [bug_reports_service_1.BugReportsService, bug_report_comments_service_1.BugReportCommentsService],
    })
], BugReportsModule);
//# sourceMappingURL=bug-reports.module.js.map