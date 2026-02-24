export type BugReportStatus = 'pending' | 'in_progress' | 'to_test' | 'done' | 'refused' | 'rejected';
export declare class BugReportEntity {
    id: string;
    subject: string;
    content: string;
    status: BugReportStatus;
    createdAt: Date;
    updatedAt: Date;
    createdByUserId: number;
    createdByUsername: string;
}
