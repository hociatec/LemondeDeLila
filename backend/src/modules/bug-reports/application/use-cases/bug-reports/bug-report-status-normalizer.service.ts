import type {
  BugReportRecord,
  BugReportStatus,
} from '../../contracts/bug-report.record';

export class BugReportStatusNormalizerService {
  normalizeStatus(status: BugReportStatus): BugReportStatus {
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
