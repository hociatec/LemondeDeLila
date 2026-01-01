import { BugReportsService } from './bug-reports.service';
import { BugReportEntity } from './entities/bug-report.entity';

function createRepoStub() {
  const store = new Map<string, BugReportEntity>();

  return {
    store,
    create: (e: Partial<BugReportEntity>) => e as BugReportEntity,
    save: async (e: BugReportEntity) => {
      store.set(e.id, e);
      return e;
    },
    find: async () => Array.from(store.values()),
    findOne: async ({ where }: any) => store.get(where.id) ?? null,
    delete: async ({ id }: any) => {
      const existed = store.delete(id);
      return { affected: existed ? 1 : 0 };
    },
  };
}

describe('BugReportsService', () => {
  it('creates and reads back', async () => {
    const repo = createRepoStub();
    const svc = new BugReportsService(repo as any);

    const created = await svc.create({
      subject: ' Sujet ',
      content: ' Contenu ',
      createdByUserId: 1,
      createdByUsername: 'admin',
    });

    expect(created.status).toBe('pending');
    const got = await svc.get(created.id);
    expect(got?.subject).toBe('Sujet');
    expect(got?.content).toBe('Contenu');
  });

  it('updates and deletes', async () => {
    const repo = createRepoStub();
    const svc = new BugReportsService(repo as any);
    const created = await svc.create({
      subject: 'Sujet',
      content: 'Contenu',
      createdByUserId: 1,
      createdByUsername: 'admin',
    });

    const updated = await svc.update(created.id, { subject: 'S2' });
    expect(updated?.subject).toBe('S2');

    const ok = await svc.delete(created.id);
    expect(ok).toBe(true);
    expect(await svc.get(created.id)).toBeNull();
  });
});

