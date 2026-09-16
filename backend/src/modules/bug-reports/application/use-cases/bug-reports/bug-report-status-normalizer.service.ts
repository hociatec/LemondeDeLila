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
    return status;
  }

  normalizeRecord(report: BugReportRecord): BugReportRecord {
    report.status = this.normalizeStatus(report.status);
    return report;
  }
}
