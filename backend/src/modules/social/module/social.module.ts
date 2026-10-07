import { Module } from '@nestjs/common';
import { ACCEPTED_FRIENDS_READER } from '../application/ports/accepted-friends-reader.port';
import { SOCIAL_PROFILE_REPOSITORY } from '../application/ports/social-profile.repository';
import { SocialProfileSettingsService } from '../application/services/social-profile-settings.service';
import { SocialProfileService } from '../application/services/social-profile.service';
import { SOCIAL_MODULE_IMPORTS } from './social.module.imports';
import { SOCIAL_CORE_PROVIDERS } from './social.module.providers.core';
import { SOCIAL_PRESENTATION_PROVIDERS } from './social.module.providers.presentation';

@Module({
  imports: SOCIAL_MODULE_IMPORTS,
  providers: [...SOCIAL_CORE_PROVIDERS, ...SOCIAL_PRESENTATION_PROVIDERS],
  exports: [
    ACCEPTED_FRIENDS_READER,
    SocialProfileSettingsService,
    SocialProfileService,
    SOCIAL_PROFILE_REPOSITORY,
  ],
})
export class SocialModule {}
