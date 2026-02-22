import { Repository } from 'typeorm';
import { BugReportEntity, BugReportStatus } from './entities/bug-report.entity';
export declare class BugReportsService {
    private readonly repo;
    constructor(repo: Repository<BugReportEntity>);
    list(): Promise<BugReportEntity[]>;
    get(id: string): Promise<BugReportEntity | null>;
    create(input: {
        subject: string;
        content: string;
        createdByUserId: number;
        createdByUsername: string;
    }): Promise<BugReportEntity>;
    update(id: string, patch: {
        subject?: string;
        content?: string;
    }): Promise<BugReportEntity | null>;
    updateStatus(id: string, status: BugReportStatus): Promise<BugReportEntity | null>;
    delete(id: string): Promise<boolean>;
}
