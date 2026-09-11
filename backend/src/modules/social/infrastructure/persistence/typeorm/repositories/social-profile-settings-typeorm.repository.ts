import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SocialProfileSettings } from '../../../../application/models/social-profile-settings.model';
import type { SocialProfileSettingsRepository } from '../../../../application/ports/social-profile-settings.repository';
import { SocialProfileSettingsEntity } from '../entities/social-profile-settings.entity';

@Injectable()
export class SocialProfileSettingsTypeormRepository implements SocialProfileSettingsRepository {
  constructor(
    @InjectRepository(SocialProfileSettingsEntity)
    private readonly repo: Repository<SocialProfileSettingsEntity>,
  ) {}

  async find(): Promise<SocialProfileSettings | null> {
    const existing = await this.repo.findOne({ where: { id: 1 } });
    if (!existing) {
      return null;
    }
    return {
      ...normalizeSettings(existing),
    };
  }

  async insert(settings: SocialProfileSettings): Promise<void> {
    await this.repo.insert({
      id: 1,
      ...normalizeSettings(settings),
    });
  }

  async save(settings: SocialProfileSettings): Promise<void> {
    await this.repo.save({
      id: 1,
      ...normalizeSettings(settings),
    });
  }
}

function normalizeSettings(
  settings: SocialProfileSettings,
): Pick<SocialProfileSettings, 'bioMinLength' | 'bioMaxLength'> {
  const max = Number.isSafeInteger(settings.bioMaxLength)
    ? Math.max(0, Math.min(20_000, settings.bioMaxLength))
    : 2_000;
  const min = Number.isSafeInteger(settings.bioMinLength)
    ? Math.max(0, Math.min(max, settings.bioMinLength))
    : 0;
  return { bioMinLength: min, bioMaxLength: max };
}
