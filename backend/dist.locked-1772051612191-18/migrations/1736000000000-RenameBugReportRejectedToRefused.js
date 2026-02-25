"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RenameBugReportRejectedToRefused1736000000000", {
    enumerable: true,
    get: function() {
        return RenameBugReportRejectedToRefused1736000000000;
    }
});
let RenameBugReportRejectedToRefused1736000000000 = class RenameBugReportRejectedToRefused1736000000000 {
    async up(queryRunner) {
        await queryRunner.query("UPDATE bug_reports SET status = 'refused' WHERE status = 'rejected'");
    }
    async down(queryRunner) {
        await queryRunner.query("UPDATE bug_reports SET status = 'rejected' WHERE status = 'refused'");
    }
    constructor(){
        this.name = 'RenameBugReportRejectedToRefused1736000000000';
    }
};
