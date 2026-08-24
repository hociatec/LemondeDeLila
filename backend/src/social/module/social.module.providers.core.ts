import { ConfigService } from '@nestjs/config';
import { SOCIAL_PROFILE_REPOSITORY } from '../application/ports/social-profile.repository';
import { SOCIAL_PROFILE_SETTINGS_DEFAULTS } from '../application/ports/social-profile-settings-defaults.port';
import { SOCIAL_PROFILE_SETTINGS_REPOSITORY } from '../application/ports/social-profile-settings.repository';
import { SOCIAL_RELATIONSHIP_REPOSITORY } from '../application/ports/social-relationship.repository';
import { SOCIAL_USER_READER } from '../application/ports/social-user.repository';
import { SocialProfileSettingsService } from '../application/services/social-profile-settings.service';
import { SocialProfileService } from '../application/services/social-profile.service';
import { SocialRelationshipService } from '../application/services/social-relationship.service';
import { SocialInteractionsService } from '../application/services/social-interactions.service';
import { SocialProfileTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/social-profile-typeorm.repository';
import { SocialProfileSettingsTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/social-profile-settings-typeorm.repository';
import { SocialRelationshipTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/social-relationship-typeorm.repository';
import { SocialUserTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/social-user-typeorm.repository';
import { createSocialProfileSettingsDefaults } from '../infrastructure/config/social-profile-settings-defaults.config';

export const SOCIAL_CORE_PROVIDERS = [
  SocialUserTypeormRepository,
  SocialProfileTypeormRepository,
  SocialRelationshipTypeormRepository,
  SocialProfileSettingsTypeormRepository,
  {
    provide: SOCIAL_USER_READER,
    useExisting: SocialUserTypeormRepository,
  },
  {
    provide: SOCIAL_PROFILE_REPOSITORY,
    useExisting: SocialProfileTypeormRepository,
  },
  {
    provide: SOCIAL_RELATIONSHIP_REPOSITORY,
    useExisting: SocialRelationshipTypeormRepository,
  },
  {
    provide: SOCIAL_PROFILE_SETTINGS_REPOSITORY,
    useExisting: SocialProfileSettingsTypeormRepository,
  },
  {
    provide: SOCIAL_PROFILE_SETTINGS_DEFAULTS,
    inject: [ConfigService],
    useFactory: createSocialProfileSettingsDefaults,
  },
  SocialProfileSettingsService,
  SocialProfileService,
  SocialRelationshipService,
  SocialInteractionsService,
];
