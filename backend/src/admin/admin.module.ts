import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { AdminUsersService } from './services/admin-users.service';
import { RoleDefinitionsService } from './services/role-definitions.service';
import { AdminUsersController } from './controllers/admin-users.controller';
import { HttpJwtGuard } from '../common/guards/http-jwt.guard';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { AdminWsHandler } from './ws/admin-ws.handler';
import { AdminWsRegistrar } from './ws/admin-ws.registrar';
import { ValidationModule } from '../common/validation/validation.module';
import { GameRegistryModule } from '../game/engine/game-registry.module';
import { NotificationModule } from '../notification/notification.module';
import { CatalogModule } from '../catalog/catalog.module';
import { BotModule as RoomBotModule } from '../bot/bot.module';
import { BotModule as GameBotModule } from '../game/modules/bot/bot.module';
import { RoleDefinitionEntity } from './entities/role-definition.entity';
import { ClientUpdatesModule } from '../client-updates/client-updates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RoleDefinitionEntity]),
    ValidationModule,
    GameRegistryModule,
    NotificationModule,
    ClientUpdatesModule,
    CatalogModule,
    RoomBotModule,
    GameBotModule,
  ],
  controllers: [AdminUsersController],
  providers: [
    AdminUsersService,
    RoleDefinitionsService,
    HttpJwtGuard,
    AdminRoleGuard,
    AdminWsHandler,
    AdminWsRegistrar,
  ],
})
export class AdminModule {}
