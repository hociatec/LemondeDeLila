"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenameBugReportRejectedToRefused1736000000000 = void 0;
class RenameBugReportRejectedToRefused1736000000000 {
    name = 'RenameBugReportRejectedToRefused1736000000000';
    async up(queryRunner) {
        await queryRunner.query("UPDATE bug_reports SET status = 'refused' WHERE status = 'rejected'");
    }
    async down(queryRunner) {
        await queryRunner.query("UPDATE bug_reports SET status = 'rejected' WHERE status = 'refused'");
    }
}
exports.RenameBugReportRejectedToRefused1736000000000 = RenameBugReportRejectedToRefused1736000000000;
//# sourceMappingURL=1736000000000-RenameBugReportRejectedToRefused.js.map