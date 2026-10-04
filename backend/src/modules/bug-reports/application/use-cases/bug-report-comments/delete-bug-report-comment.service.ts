import type { BugReportCommentRepository } from '../../ports/bug-report.repository';

export class DeleteBugReportCommentService {
  constructor(private readonly comments: BugReportCommentRepository) {}

  execute(reportId: string, commentId: string): Promise<boolean> {
    return this.comments.delete(reportId, commentId);
  }
}
