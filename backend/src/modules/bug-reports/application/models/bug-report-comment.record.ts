export type BugReportCommentRecord = {
  id: string;
  reportId: string;
  content: string;
  createdAt: Date;
  createdByUserId: number;
  createdByUsername: string;
};
