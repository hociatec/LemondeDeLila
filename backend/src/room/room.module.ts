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
import { RoomDirectoryWsHandler } from './gateways/room-directory-ws.handler';
import { RoomWsRegistrar } from './gateways/room-ws.registrar';
import { CatalogModule } from '../catalog/catalog.module';
import { StatsModule } from '../stats/stats.module';
import { ClientUpdatesModule } from '../client-updates/client-updates.module';
import { PublicRoomDirectoryService } from './services/public-room-directory.service';
import { PublicRoomDirectoryBinder } from './services/public-room-directory.binder';
import { RoomRealtimeTrackerService } from './services/room-realtime-tracker.service';
import { RoomAutoCleanupService } from './services/room-auto-cleanup.service';
import { RoomMaintenanceSettingsService } from './services/room-maintenance-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomParticipant, RoomBot, User]),
    forwardRef(() => BotModule),
    forwardRef(() => PresenceModule),
    NotificationModule,
    ClientUpdatesModule,
    CatalogModule,
    StatsModule,
  ],
  providers: [
    RoomService,
    RoomGateway,
    RoomInviteService,
    PublicRoomDirectoryService,
    PublicRoomDirectoryBinder,
    RoomRealtimeTrackerService,
    RoomMaintenanceSettingsService,
    RoomAutoCleanupService,
    RoomDirectoryWsHandler,
    RoomWsRegistrar,
  ],
  exports: [RoomService, RoomMaintenanceSettingsService],
})
export class RoomModule {}
