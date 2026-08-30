import { CreateBugReportService } from './create-bug-report.service';
import { DeleteBugReportService } from './delete-bug-report.service';
import { GetBugReportService } from './get-bug-report.service';
import { ListBugReportsService } from './list-bug-reports.service';
import { UpdateBugReportService } from './update-bug-report.service';
import { UpdateBugReportStatusService } from './update-bug-report-status.service';
import { BugReportStatusNormalizerService } from './bug-report-status-normalizer.service';
import type { BugReportRepository } from '../../ports/bug-report.repository';
import type { BugReportRecord } from '../../contracts/bug-report.record';
import { AddBugReportCommentService } from '../bug-report-comments/add-bug-report-comment.service';
import { CountBugReportCommentsService } from '../bug-report-comments/count-bug-report-comments.service';
import { ListBugReportCommentsService } from '../bug-report-comments/list-bug-report-comments.service';
import type { BugReportCommentRepository } from '../../ports/bug-report.repository';

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

  it('bounds comments, deduplicates counts and refuses comments on invisible reports', async () => {
    const reports = createRepoStub();
    const comments = {
      save: jest.fn(async (record) => record),
      listByReportId: jest.fn().mockResolvedValue([]),
      countByReportIds: jest.fn().mockResolvedValue({ report: 2 }),
    };
    const commentRepo = comments as unknown as BugReportCommentRepository;

    const add = new AddBugReportCommentService(
      commentRepo,
      reports as unknown as BugReportRepository,
    );
    await expect(
      add.execute({
        reportId: 'missing',
        content: 'secret',
        createdByUserId: 1,
        createdByUsername: 'admin',
      }),
    ).resolves.toBeNull();
    expect(comments.save).not.toHaveBeenCalled();

    await new ListBugReportCommentsService(commentRepo).execute(' report ', {
      offset: -10,
      limit: 50_000,
    });
    expect(comments.listByReportId).toHaveBeenCalledWith('report', {
      offset: 0,
      limit: 100,
    });

    await new CountBugReportCommentsService(commentRepo).execute([
      ' report ',
      'report',
      '',
    ]);
    expect(comments.countByReportIds).toHaveBeenCalledWith(['report']);
  });

  it('keeps concurrent comments distinct on the same visible report', async () => {
    const reports = createRepoStub();
    const now = new Date();
    await reports.save({
      id: 'report',
      subject: 'Sujet',
      content: 'Contenu',
      status: 'pending',
      createdByUserId: 1,
      createdByUsername: 'admin',
      createdAt: now,
      updatedAt: now,
    });
    const savedIds = new Set<string>();
    const comments = {
      save: jest.fn(async (record) => {
        savedIds.add(record.id);
        return record;
      }),
      listByReportId: jest.fn(),
      countByReportIds: jest.fn(),
    } as unknown as BugReportCommentRepository;
    const add = new AddBugReportCommentService(
      comments,
      reports as unknown as BugReportRepository,
    );

    const created = await Promise.all(
      Array.from({ length: 16 }, (_, index) =>
        add.execute({
          reportId: 'report',
          content: `comment-${index}`,
          createdByUserId: index + 1,
          createdByUsername: `admin-${index}`,
        }),
      ),
    );

    expect(created).not.toContain(null);
    expect(savedIds.size).toBe(16);
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
