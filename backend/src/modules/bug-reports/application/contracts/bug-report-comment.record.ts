export type BugReportCommentRecord = {
  id: string;
  reportId: string;
  content: string;
  createdAt: Date;
  createdByUserId: number;
  createdByUsername: string;
};
/** Explicitly named data contract at the application boundary. */
