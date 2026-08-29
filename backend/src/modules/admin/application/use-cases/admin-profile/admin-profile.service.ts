import { Inject, Injectable } from '@nestjs/common';
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
    return this.settings.update(update);
  }
}
