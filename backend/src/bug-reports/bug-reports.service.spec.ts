import type { Repository } from 'typeorm';
import { BugReportsService } from './bug-reports.service';
import { BugReportEntity } from './entities/bug-report.entity';

type RepoStub = {
  create(entity: Partial<BugReportEntity>): BugReportEntity;
  save(entity: BugReportEntity): Promise<BugReportEntity>;
  find(): Promise<BugReportEntity[]>;
  findOne(args: { where: { id: string } }): Promise<BugReportEntity | null>;
  delete(args: { id: string }): Promise<{ affected: number }>;
};

function createRepoStub(): RepoStub {
  const store = new Map<string, BugReportEntity>();

  return {
    create: (entity: Partial<BugReportEntity>) => entity as BugReportEntity,
    save: (entity: BugReportEntity) => {
      store.set(entity.id, entity);
      return Promise.resolve(entity);
    },
    find: () => Promise.resolve(Array.from(store.values())),
    findOne: ({ where }: { where: { id: string } }) =>
      Promise.resolve(store.get(where.id) ?? null),
    delete: ({ id }: { id: string }) =>
      Promise.resolve({ affected: store.delete(id) ? 1 : 0 }),
  };
}

describe('BugReportsService', () => {
  it('creates and reads back', async () => {
    const repo = createRepoStub();
    const svc = new BugReportsService(
      repo as unknown as Repository<BugReportEntity>,
    );

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
    const svc = new BugReportsService(
      repo as unknown as Repository<BugReportEntity>,
    );
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
