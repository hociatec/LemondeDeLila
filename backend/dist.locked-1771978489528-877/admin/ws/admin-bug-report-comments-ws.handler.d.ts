import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { BugReportCommentsService } from '../../bug-reports/bug-report-comments.service';
export declare class AdminBugReportCommentsWsHandler {
    private readonly validator;
    private readonly comments;
    constructor(validator: PayloadValidationService, comments: BugReportCommentsService);
    list(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            items: import("../../bug-reports/entities/bug-report-comment.entity").BugReportCommentEntity[];
        };
    }>;
    add(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            comment: import("../../bug-reports/entities/bug-report-comment.entity").BugReportCommentEntity;
            reportId: string;
            commentsCount: number;
        };
    }>;
}
