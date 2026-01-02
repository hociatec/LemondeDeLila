import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialProfileSettingsEntity } from '../entities/social-profile-settings.entity';

export type SocialProfileSettings = {
  bioMinLength: number;
  bioMaxLength: number;
};

@Injectable()
export class SocialProfileSettingsService implements OnModuleInit {
  private cache: SocialProfileSettings | null = null;

  constructor(
    @InjectRepository(SocialProfileSettingsEntity)
    private readonly repo: Repository<SocialProfileSettingsEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  private defaults(): SocialProfileSettings {
    const min = Number.parseInt((process.env.PROFILE_BIO_MIN_LENGTH || '0').trim(), 10);
    const max = Number.parseInt((process.env.PROFILE_BIO_MAX_LENGTH || '500').trim(), 10);
    return this.normalize({ bioMinLength: min, bioMaxLength: max });
  }

  private normalize(input: Partial<SocialProfileSettings>): SocialProfileSettings {
    const min = Number.isFinite(input.bioMinLength as number)
      ? Math.max(0, Math.floor(input.bioMinLength as number))
      : 0;
    const max = Number.isFinite(input.bioMaxLength as number)
      ? Math.max(0, Math.min(5000, Math.floor(input.bioMaxLength as number)))
      : 500;
    const clampedMin = Math.min(min, max);
    return { bioMinLength: clampedMin, bioMaxLength: max };
  }

  get(): SocialProfileSettings {
    return this.cache ?? this.defaults();
  }

  async update(patch: Partial<SocialProfileSettings>): Promise<SocialProfileSettings> {
    await this.ensureSeeded();
    const current = this.get();
    const next = this.normalize({ ...current, ...patch });
    await this.repo.save({
      id: 1,
      bioMinLength: next.bioMinLength,
      bioMaxLength: next.bioMaxLength,
    });
    this.cache = next;
    return next;
  }

  private async ensureSeeded(): Promise<void> {
    if (this.cache) return;

    const existing = await this.repo.findOne({ where: { id: 1 } });
    if (existing) {
      this.cache = this.normalize({
        bioMinLength: existing.bioMinLength,
        bioMaxLength: existing.bioMaxLength,
      });
      return;
    }

    const seed = this.defaults();
    await this.repo.insert({
      id: 1,
      bioMinLength: seed.bioMinLength,
      bioMaxLength: seed.bioMaxLength,
    });
    this.cache = seed;
  }
}
