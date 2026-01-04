import { SocialProfileSettingsService } from './social-profile-settings.service';
import { SocialProfileSettingsEntity } from '../entities/social-profile-settings.entity';

describe('SocialProfileSettingsService', () => {
  function createRepo() {
    let store: SocialProfileSettingsEntity | null = null;

    return {
      repo: {
        findOne: jest.fn(async () => store),
        insert: jest.fn(async (row: Partial<SocialProfileSettingsEntity>) => {
          store = {
            id: row.id ?? 1,
            bioMinLength: row.bioMinLength ?? 0,
            bioMaxLength: row.bioMaxLength ?? 500,
          } as SocialProfileSettingsEntity;
          return { identifiers: [{ id: store.id }] } as any;
        }),
        save: jest.fn(async (row: Partial<SocialProfileSettingsEntity>) => {
          store = {
            id: row.id ?? store?.id ?? 1,
            bioMinLength: row.bioMinLength ?? store?.bioMinLength ?? 0,
            bioMaxLength: row.bioMaxLength ?? store?.bioMaxLength ?? 500,
          } as SocialProfileSettingsEntity;
          return store;
        }),
      },
      getStore: () => store,
    };
  }

  it('clamps min to max and caps max', async () => {
    const { repo } = createRepo();
    const svc = new SocialProfileSettingsService(repo as any);

    const updated = await svc.update({ bioMinLength: 999999, bioMaxLength: 200000 });
    expect(updated.bioMaxLength).toBe(100000);
    expect(updated.bioMinLength).toBe(100000);
  });

  it('loads settings from repo after init', async () => {
    const { repo } = createRepo();
    const svc = new SocialProfileSettingsService(repo as any);

    await svc.update({ bioMinLength: 10, bioMaxLength: 20 });

    const svc2 = new SocialProfileSettingsService(repo as any);
    await svc2.onModuleInit();
    expect(svc2.get()).toEqual({ bioMinLength: 10, bioMaxLength: 20 });
  });
});

