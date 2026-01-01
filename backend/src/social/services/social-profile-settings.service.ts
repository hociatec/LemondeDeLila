import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type SocialProfileSettings = {
  bioMinLength: number;
  bioMaxLength: number;
};

type StoredSocialProfileSettings = Partial<SocialProfileSettings>;

@Injectable()
export class SocialProfileSettingsService {
  private readonly settingsPath: string;

  constructor(rootDir?: string) {
    const base = rootDir || process.cwd();
    this.settingsPath = path.resolve(base, 'data', 'social-profile-settings.json');
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
    const base = this.defaults();
    try {
      if (!fs.existsSync(this.settingsPath)) {
        return base;
      }
      const raw = fs
        .readFileSync(this.settingsPath, 'utf-8')
        .replace(/^\uFEFF/, '');
      const parsed = JSON.parse(raw) as StoredSocialProfileSettings;
      return this.normalize({ ...base, ...parsed });
    } catch {
      return base;
    }
  }

  update(patch: Partial<SocialProfileSettings>): SocialProfileSettings {
    const current = this.get();
    const next = this.normalize({ ...current, ...patch });
    try {
      fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true });
      fs.writeFileSync(this.settingsPath, JSON.stringify(next, null, 2), 'utf-8');
    } catch {
      // best effort
    }
    return next;
  }
}

