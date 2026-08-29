import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from '../../notification/public-api';
import { User } from '../../user/public-api';
import { SocialProfileEntity } from '../infrastructure/persistence/typeorm/entities/social-profile.entity';
import { SocialRelationshipEntity } from '../infrastructure/persistence/typeorm/entities/social-relationship.entity';
import { SocialProfileSettingsEntity } from '../infrastructure/persistence/typeorm/entities/social-profile-settings.entity';

export const SOCIAL_MODULE_IMPORTS = [
  TypeOrmModule.forFeature([
    SocialRelationshipEntity,
    SocialProfileEntity,
    SocialProfileSettingsEntity,
    User,
  ]),
  NotificationModule,
];
