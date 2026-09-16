import type {
  BugReportRecord,
  BugReportStatus,
  LegacyBugReportStatus,
} from '../../read-models/bug-report.record';

export class BugReportStatusNormalizerService {
  normalizeStatus(status: LegacyBugReportStatus): BugReportStatus {
    if (status === 'rejected') {
      return 'refused';
    }
    if (status === 'done') return 'to_test';
    return status;
  }

  normalizeRecord(report: BugReportRecord): BugReportRecord {
    report.status = this.normalizeStatus(report.status);
    return report;
  }
}
