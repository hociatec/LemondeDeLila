export type BugReportStatus =
  'pending' | 'in_progress' | 'to_test' | 'refused' | 'rejected';

/** Values retained only while old rows are migrated. They are never exposed. */
export type LegacyBugReportStatus = BugReportStatus | 'done';

export type BugReportRecord = {
  id: string;
  subject: string;
  content: string;
  status: BugReportStatus;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: number;
  createdByUsername: string;
};
/** Explicitly named data contract at the application boundary. */
