import { Repository } from 'typeorm';
import { BugReportEntity } from './entities/bug-report.entity';
import { BugReportCommentEntity } from './entities/bug-report-comment.entity';
export declare class BugReportCommentsService {
    private readonly repo;
    private readonly reports;
    constructor(repo: Repository<BugReportCommentEntity>, reports: Repository<BugReportEntity>);
    countByReportIds(reportIds: string[]): Promise<Record<string, number>>;
    listByReportId(reportId: string): Promise<BugReportCommentEntity[]>;
    add(input: {
        reportId: string;
        content: string;
        createdByUserId: number;
        createdByUsername: string;
    }): Promise<BugReportCommentEntity | null>;
}
