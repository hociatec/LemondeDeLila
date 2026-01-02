import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from '../notification/notification.module';
import { User } from '../user/entities/user.entity';
import { SocialProfile } from './entities/social-profile.entity';
import { SocialRelationship } from './entities/social-relationship.entity';
import { SocialProfileSettingsEntity } from './entities/social-profile-settings.entity';
import { SocialService } from './services/social.service';
import { SocialProfileSettingsService } from './services/social-profile-settings.service';
import { SocialWsHandler } from './ws/social-ws.handler';
import { SocialWsRegistrar } from './ws/social-ws.registrar';

@Module({
  imports: [
    TypeOrmModule.forFeature([SocialRelationship, SocialProfile, SocialProfileSettingsEntity, User]),
    NotificationModule,
  ],
  providers: [SocialProfileSettingsService, SocialService, SocialWsHandler, SocialWsRegistrar],
  exports: [SocialService, SocialProfileSettingsService],
})
export class SocialModule {}
