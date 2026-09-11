import { ConfigService } from '@nestjs/config';
import type { SocialProfileSettingsDefaults } from '../../application/ports/social-profile-settings-defaults.port';

export function createSocialProfileSettingsDefaults(
  config: ConfigService,
): SocialProfileSettingsDefaults {
  const minCandidate = Number(
    String(config.get<string>('PROFILE_BIO_MIN_LENGTH') ?? '0'),
  );
  const maxCandidate = Number(
    String(config.get<string>('PROFILE_BIO_MAX_LENGTH') ?? '500'),
  );
  const bioMinLength = Number.isSafeInteger(minCandidate)
    ? Math.min(Math.max(minCandidate, 0), 10_000)
    : 0;
  const configuredMax = Number.isSafeInteger(maxCandidate)
    ? Math.min(Math.max(maxCandidate, 0), 10_000)
    : 500;
  return {
    bioMinLength,
    bioMaxLength: Math.max(configuredMax, bioMinLength),
  };
}
