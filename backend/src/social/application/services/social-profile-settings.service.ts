import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { SocialProfileSettings } from '../models/social-profile-settings.model';
import {
  SOCIAL_PROFILE_SETTINGS_REPOSITORY,
  type SocialProfileSettingsRepository,
} from '../ports/social-profile-settings.repository';
import {
  SOCIAL_PROFILE_SETTINGS_DEFAULTS,
  type SocialProfileSettingsDefaults,
} from '../ports/social-profile-settings-defaults.port';

const BioHardMaxLength = 100000;

@Injectable()
export class SocialProfileSettingsService implements OnModuleInit {
  private cache: SocialProfileSettings | null = null;

  constructor(
    @Inject(SOCIAL_PROFILE_SETTINGS_REPOSITORY)
    private readonly repo: SocialProfileSettingsRepository,
    @Inject(SOCIAL_PROFILE_SETTINGS_DEFAULTS)
    private readonly defaultsConfig: SocialProfileSettingsDefaults,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  private defaults(): SocialProfileSettings {
    return this.normalize(this.defaultsConfig);
  }

  private normalize(
    input: Partial<SocialProfileSettings>,
  ): SocialProfileSettings {
    const min = Number.isFinite(input.bioMinLength as number)
      ? Math.max(0, Math.floor(input.bioMinLength as number))
      : 0;
    const max = Number.isFinite(input.bioMaxLength as number)
      ? Math.max(
          0,
          Math.min(BioHardMaxLength, Math.floor(input.bioMaxLength as number)),
        )
      : 500;
    const clampedMin = Math.min(min, max);
    return { bioMinLength: clampedMin, bioMaxLength: max };
  }

  get(): SocialProfileSettings {
    return this.cache ?? this.defaults();
  }

  async update(
    patch: Partial<SocialProfileSettings>,
  ): Promise<SocialProfileSettings> {
    await this.ensureSeeded();
    const current = this.get();
    const next = this.normalize({ ...current, ...patch });
    await this.repo.save(next);
    this.cache = next;
    return next;
  }

  private async ensureSeeded(): Promise<void> {
    if (this.cache) return;

    const existing = await this.repo.find();
    if (existing) {
      this.cache = this.normalize(existing);
      return;
    }

    const seed = this.defaults();
    await this.repo.insert(seed);
    this.cache = seed;
  }
}
