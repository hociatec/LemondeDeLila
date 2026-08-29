import { ConfigService } from '@nestjs/config';
import type { SocialProfileSettingsDefaults } from '../../application/ports/social-profile-settings-defaults.port';

export function createSocialProfileSettingsDefaults(
  config: ConfigService,
): SocialProfileSettingsDefaults {
  return {
    bioMinLength: Number.parseInt(
      String(config.get<string>('PROFILE_BIO_MIN_LENGTH') ?? '0'),
      10,
    ),
    bioMaxLength: Number.parseInt(
      String(config.get<string>('PROFILE_BIO_MAX_LENGTH') ?? '500'),
      10,
    ),
  };
}
