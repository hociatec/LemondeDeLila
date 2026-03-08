"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminBugReportCommentsWsHandler", {
    enumerable: true,
    get: function() {
        return AdminBugReportCommentsWsHandler;
    }
});
const _common = require("@nestjs/common");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _bugreportcommentsservice = require("../../bug-reports/bug-report-comments.service");
const _adminbugreportcommentsdto = require("./admin-bug-report-comments.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AdminBugReportCommentsWsHandler = class AdminBugReportCommentsWsHandler {
    async list(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminbugreportcommentsdto.AdminBugReportCommentsListWsDto, payload);
        const items = await this.comments.listByReportId(dto.reportId);
        return {
            type: 'admin.bugReports.comments.list',
            payload: {
                items
            }
        };
    }
    async add(session, payload) {
        const user = (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminbugreportcommentsdto.AdminBugReportCommentAddWsDto, payload);
        const comment = await this.comments.add({
            reportId: dto.reportId,
            content: dto.content,
            createdByUserId: user.id,
            createdByUsername: user.username
        });
        if (!comment) {
            throw new _common.BadRequestException('Rapport introuvable');
        }
        const counts = await this.comments.countByReportIds([
            dto.reportId
        ]);
        return {
            type: 'admin.bugReports.comments.add',
            payload: {
                comment,
                reportId: dto.reportId,
                commentsCount: counts[dto.reportId] ?? 0
            }
        };
    }
    constructor(validator, comments){
        this.validator = validator;
        this.comments = comments;
    }
};
AdminBugReportCommentsWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _bugreportcommentsservice.BugReportCommentsService === "undefined" ? Object : _bugreportcommentsservice.BugReportCommentsService
    ])
], AdminBugReportCommentsWsHandler);
