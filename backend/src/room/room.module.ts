import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { RoomParticipant } from './entities/room-participant.entity';
import { RoomBot } from './entities/room-bot.entity';
import { RoomService } from './services/room.service';
import { RoomGateway } from './gateways/room.gateway';
import { User } from '../user/entities/user.entity';
import { forwardRef } from '@nestjs/common';
import { BotModule } from '../bot/bot.module';
import { PresenceModule } from '../presence/presence.module';
import { NotificationModule } from '../notification/notification.module';
import { RoomInviteService } from './services/room-invite.service';
import { RoomLobbyWsHandler } from './gateways/room-lobby-ws.handler';
import { RoomWsRegistrar } from './gateways/room-ws.registrar';
import { CatalogModule } from '../catalog/catalog.module';
import { StatsModule } from '../stats/stats.module';
import { ClientUpdatesModule } from '../client-updates/client-updates.module';
import { RoomLobbyRefreshService } from './services/room-lobby-refresh.service';
import { RoomLobbyRefreshBinder } from './services/room-lobby-refresh.binder';
import { RoomRealtimeTrackerService } from './services/room-realtime-tracker.service';
import { RoomAutoCleanupService } from './services/room-auto-cleanup.service';
import { RoomMaintenanceSettingsService } from './services/room-maintenance-settings.service';
import { RoomMaintenanceSettingsEntity } from './entities/room-maintenance-settings.entity';
import { VaultRoomSnapshotEntity } from '../vault/entities/vault-room-snapshot.entity';
import { SoundsModule } from '../sounds/sounds.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Room,
      RoomParticipant,
      RoomBot,
      RoomMaintenanceSettingsEntity,
      VaultRoomSnapshotEntity,
      User,
    ]),
    forwardRef(() => BotModule),
    forwardRef(() => PresenceModule),
    NotificationModule,
    ClientUpdatesModule,
    SoundsModule,
    CatalogModule,
    StatsModule,
  ],
  providers: [
    RoomService,
    RoomGateway,
    RoomInviteService,
    RoomLobbyRefreshService,
    RoomLobbyRefreshBinder,
    RoomRealtimeTrackerService,
    RoomMaintenanceSettingsService,
    RoomAutoCleanupService,
    RoomLobbyWsHandler,
    RoomWsRegistrar,
  ],
  exports: [RoomService, RoomMaintenanceSettingsService],
})
export class RoomModule {}
