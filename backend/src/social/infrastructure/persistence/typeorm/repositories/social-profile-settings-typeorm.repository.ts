import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SocialProfileSettings } from '../../../../application/models/social-profile-settings.model';
import type { SocialProfileSettingsRepository } from '../../../../application/ports/social-profile-settings.repository';
import { SocialProfileSettingsEntity } from '../entities/social-profile-settings.entity';

@Injectable()
export class SocialProfileSettingsTypeormRepository
  implements SocialProfileSettingsRepository
{
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
      bioMinLength: existing.bioMinLength,
      bioMaxLength: existing.bioMaxLength,
    };
  }

  async insert(settings: SocialProfileSettings): Promise<void> {
    await this.repo.insert({
      id: 1,
      bioMinLength: settings.bioMinLength,
      bioMaxLength: settings.bioMaxLength,
    });
  }

  async save(settings: SocialProfileSettings): Promise<void> {
    await this.repo.save({
      id: 1,
      bioMinLength: settings.bioMinLength,
      bioMaxLength: settings.bioMaxLength,
    });
  }
}
