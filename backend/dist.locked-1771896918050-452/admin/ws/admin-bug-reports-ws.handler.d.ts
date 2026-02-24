import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { BugReportsService } from '../../bug-reports/bug-reports.service';
import { BugReportCommentsService } from '../../bug-reports/bug-report-comments.service';
import type { BugReportEntity } from '../../bug-reports/entities/bug-report.entity';
export declare class AdminBugReportsWsHandler {
    private readonly validator;
    private readonly reports;
    private readonly comments;
    constructor(validator: PayloadValidationService, reports: BugReportsService, comments: BugReportCommentsService);
    create(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            report: BugReportEntity;
        };
    }>;
    list(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            items: {
                commentsCount: number;
                id: string;
                subject: string;
                content: string;
                status: import("../../bug-reports/entities/bug-report.entity").BugReportStatus;
                createdAt: Date;
                updatedAt: Date;
                createdByUserId: number;
                createdByUsername: string;
            }[];
        };
    }>;
    get(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            report: {
                commentsCount: number;
                id: string;
                subject: string;
                content: string;
                status: import("../../bug-reports/entities/bug-report.entity").BugReportStatus;
                createdAt: Date;
                updatedAt: Date;
                createdByUserId: number;
                createdByUsername: string;
            };
        };
    }>;
    update(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            report: BugReportEntity;
        };
    }>;
    updateStatus(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            report: BugReportEntity;
        };
    }>;
    delete(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            removed: boolean;
        };
    }>;
}
