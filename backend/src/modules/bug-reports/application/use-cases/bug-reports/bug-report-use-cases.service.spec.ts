import { CreateBugReportService } from './create-bug-report.service';
import { DeleteBugReportService } from './delete-bug-report.service';
import { GetBugReportService } from './get-bug-report.service';
import { ListBugReportsService } from './list-bug-reports.service';
import { UpdateBugReportService } from './update-bug-report.service';
import { UpdateBugReportStatusService } from './update-bug-report-status.service';
import { BugReportStatusNormalizerService } from './bug-report-status-normalizer.service';
import type { BugReportRepository } from '../../ports/bug-report.repository';
import type { BugReportRecord } from '../../models/bug-report.record';

type RepoStub = {
  save(entity: BugReportRecord): Promise<BugReportRecord>;
  list(): Promise<BugReportRecord[]>;
  findById(id: string): Promise<BugReportRecord | null>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
};

function createRepoStub(): RepoStub {
  const store = new Map<string, BugReportRecord>();

  return {
    save: (entity: BugReportRecord) => {
      store.set(entity.id, entity);
      return Promise.resolve(entity);
    },
    list: () => Promise.resolve(Array.from(store.values())),
    findById: (id: string) => Promise.resolve(store.get(id) ?? null),
    delete: (id: string) => Promise.resolve(store.delete(id)),
    exists: (id: string) => Promise.resolve(store.has(id)),
  };
}

describe('Bug report use cases', () => {
  it('creates and reads back', async () => {
    const repo = createRepoStub();
    const normalizer = new BugReportStatusNormalizerService();
    const createBugReport = new CreateBugReportService(
      repo as unknown as BugReportRepository,
    );
    const getBugReport = new GetBugReportService(
      repo as unknown as BugReportRepository,
      normalizer,
    );

    const created = await createBugReport.execute({
      subject: ' Sujet ',
      content: ' Contenu ',
      createdByUserId: 1,
      createdByUsername: 'admin',
    });

    expect(created.status).toBe('pending');
    const got = await getBugReport.execute(created.id);
    expect(got?.subject).toBe('Sujet');
    expect(got?.content).toBe('Contenu');
  });

  it('updates, normalizes status and deletes', async () => {
    const repo = createRepoStub();
    const normalizer = new BugReportStatusNormalizerService();
    const createBugReport = new CreateBugReportService(
      repo as unknown as BugReportRepository,
    );
    const getBugReport = new GetBugReportService(
      repo as unknown as BugReportRepository,
      normalizer,
    );
    const updateBugReport = new UpdateBugReportService(
      repo as unknown as BugReportRepository,
      getBugReport,
    );
    const updateBugReportStatus = new UpdateBugReportStatusService(
      repo as unknown as BugReportRepository,
      getBugReport,
      normalizer,
    );
    const listBugReports = new ListBugReportsService(
      repo as unknown as BugReportRepository,
      normalizer,
    );
    const deleteBugReport = new DeleteBugReportService(
      repo as unknown as BugReportRepository,
    );
    const created = await createBugReport.execute({
      subject: 'Sujet',
      content: 'Contenu',
      createdByUserId: 1,
      createdByUsername: 'admin',
    });

    const updated = await updateBugReport.execute(created.id, {
      subject: 'S2',
    });
    expect(updated?.subject).toBe('S2');

    const statusUpdated = await updateBugReportStatus.execute(
      created.id,
      'rejected',
    );
    expect(statusUpdated?.status).toBe('refused');

    const listed = await listBugReports.execute();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.status).toBe('refused');

    const ok = await deleteBugReport.execute(created.id);
    expect(ok).toBe(true);
    expect(await getBugReport.execute(created.id)).toBeNull();
  });
});
