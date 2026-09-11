import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_PROFILE_SETTINGS_PORT,
  type AdminProfileSettingsPort,
} from '../../ports/admin-profile-settings.port';

@Injectable()
export class AdminProfileService {
  constructor(
    @Inject(ADMIN_PROFILE_SETTINGS_PORT)
    private readonly settings: AdminProfileSettingsPort,
  ) {}

  getSettings() {
    return this.settings.get();
  }

  async updateSettings(update: {
    bioMinLength?: number;
    bioMaxLength?: number;
  }) {
    for (const value of [update.bioMinLength, update.bioMaxLength]) {
      if (
        value !== undefined &&
        (!Number.isSafeInteger(value) || value < 0 || value > 100_000)
      ) {
        throw new BadRequestException('Paramètres de profil invalides');
      }
    }
    return this.settings.update(update);
  }
}
