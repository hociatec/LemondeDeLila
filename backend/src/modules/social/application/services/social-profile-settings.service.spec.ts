import { SocialProfileSettingsService } from './social-profile-settings.service';
import type { SocialProfileSettings } from '../contracts/social-profile-settings.model';
import { createSocialProfileSettingsDefaults } from '../../infrastructure/config/social-profile-settings-defaults.config';
import { ConfigService } from '@nestjs/config';

describe('SocialProfileSettingsService', () => {
  function createRepo() {
    let store: SocialProfileSettings | null = null;

    return {
      repo: {
        find: jest.fn(async () => store),
        insert: jest.fn(async (row: SocialProfileSettings) => {
          store = {
            bioMinLength: row.bioMinLength ?? 0,
            bioMaxLength: row.bioMaxLength ?? 500,
          };
        }),
        save: jest.fn(async (row: SocialProfileSettings) => {
          store = {
            bioMinLength: row.bioMinLength ?? store?.bioMinLength ?? 0,
            bioMaxLength: row.bioMaxLength ?? store?.bioMaxLength ?? 500,
          };
        }),
      },
      getStore: () => store,
    };
  }

  it('clamps min to max and caps max', async () => {
    const { repo } = createRepo();
    const svc = new SocialProfileSettingsService(
      repo as any,
      createSocialProfileSettingsDefaults(new ConfigService()),
    );

    const updated = await svc.update({
      bioMinLength: 999999,
      bioMaxLength: 200000,
    });
    expect(updated.bioMaxLength).toBe(100000);
    expect(updated.bioMinLength).toBe(100000);
  });

  it('loads settings from repo after init', async () => {
    const { repo } = createRepo();
    const svc = new SocialProfileSettingsService(
      repo as any,
      createSocialProfileSettingsDefaults(new ConfigService()),
    );

    await svc.update({ bioMinLength: 10, bioMaxLength: 20 });

    const svc2 = new SocialProfileSettingsService(
      repo as any,
      createSocialProfileSettingsDefaults(new ConfigService()),
    );
    await svc2.onModuleInit();
    expect(svc2.get()).toEqual({ bioMinLength: 10, bioMaxLength: 20 });
  });
});
