import type { SocialProfileSettings } from '../contracts/social-profile-settings.model';

export const SOCIAL_PROFILE_SETTINGS_REPOSITORY = Symbol(
  'SOCIAL_PROFILE_SETTINGS_REPOSITORY',
);

export interface SocialProfileSettingsRepository {
  find(): Promise<SocialProfileSettings | null>;
  insert(settings: SocialProfileSettings): Promise<void>;
  save(settings: SocialProfileSettings): Promise<void>;
}
