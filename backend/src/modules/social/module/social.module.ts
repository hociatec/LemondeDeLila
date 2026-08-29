import { Module } from '@nestjs/common';
import { SOCIAL_PROFILE_REPOSITORY } from '../application/ports/social-profile.repository';
import { SocialInteractionsService } from '../application/services/social-interactions.service';
import { SocialProfileSettingsService } from '../application/services/social-profile-settings.service';
import { SOCIAL_MODULE_IMPORTS } from './social.module.imports';
import { SOCIAL_CORE_PROVIDERS } from './social.module.providers.core';
import { SOCIAL_PRESENTATION_PROVIDERS } from './social.module.providers.presentation';

@Module({
  imports: SOCIAL_MODULE_IMPORTS,
  providers: [...SOCIAL_CORE_PROVIDERS, ...SOCIAL_PRESENTATION_PROVIDERS],
  exports: [
    SocialInteractionsService,
    SocialProfileSettingsService,
    SOCIAL_PROFILE_REPOSITORY,
  ],
})
export class SocialModule {}
