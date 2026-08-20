import { TypeOrmModule } from '@nestjs/typeorm';

import { BotModule as RoomBotModule } from '../../bot/module/bot.module';
import { BugReportsModule } from '../../bug-reports/module/bug-reports.module';
import { CatalogModule } from '../../catalog/catalog.module';
import { ChatModule } from '../../chat/chat.module';
import { ClientUpdatesModule } from '../../client-updates/client-updates.module';
import { ValidationModule } from '../../common/validation/validation.module';
import { GameRegistryModule } from '../../game/engine/game-registry.module';
import { ArcheDeMnemosyneModule } from '../../game/games/vents-infinis/arche-de-mnemosyne/arche-de-mnemosyne.module';
import { BotModule as GameBotModule } from '../../game/modules/bot/bot.module';
import { NotificationModule } from '../../notification/notification.module';
import { RoomModule } from '../../room/room.module';
import { SocialModule } from '../../social/social.module';
import { StatsModule } from '../../stats/stats.module';
import { User } from '../../user/entities/user.entity';
import { RoleDefinitionEntity } from '../infrastructure/persistence/typeorm/entities/role-definition.entity';

export const ADMIN_MODULE_IMPORTS = [
  TypeOrmModule.forFeature([User, RoleDefinitionEntity]),
  ValidationModule,
  GameRegistryModule,
  ArcheDeMnemosyneModule,
  NotificationModule,
  ClientUpdatesModule,
  ChatModule,
  CatalogModule,
  RoomBotModule,
  GameBotModule,
  RoomModule,
  SocialModule,
  BugReportsModule,
  StatsModule,
];
