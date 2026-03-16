"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BugReportsModule", {
    enumerable: true,
    get: function() {
        return BugReportsModule;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _bugreportentity = require("./entities/bug-report.entity");
const _bugreportsservice = require("./bug-reports.service");
const _bugreportcommententity = require("./entities/bug-report-comment.entity");
const _bugreportcommentsservice = require("./bug-report-comments.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let BugReportsModule = class BugReportsModule {
};
BugReportsModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _typeorm.TypeOrmModule.forFeature([
                _bugreportentity.BugReportEntity,
                _bugreportcommententity.BugReportCommentEntity
            ])
        ],
        providers: [
            _bugreportsservice.BugReportsService,
            _bugreportcommentsservice.BugReportCommentsService
        ],
        exports: [
            _bugreportsservice.BugReportsService,
            _bugreportcommentsservice.BugReportCommentsService
        ]
    })
], BugReportsModule);
