import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { RoomParticipant } from './entities/room-participant.entity';
import { RoomBot } from './entities/room-bot.entity';
import { RoomService } from './services/room.service';
import { RoomGateway } from './gateways/room.gateway';
import { RoomGatewayActionsService } from './gateways/room-gateway-actions.service';
import { RoomGatewayCommandService } from './gateways/room-gateway-command.service';
import { RoomGatewayConnectionService } from './gateways/room-gateway-connection.service';
import { RoomGatewayLifecycleService } from './gateways/room-gateway-lifecycle.service';
import { RoomGatewayPresenceService } from './gateways/room-gateway-presence.service';
import { RoomGatewaySessionService } from './gateways/room-gateway-session.service';
import { RoomGatewayStateService } from './gateways/room-gateway-state.service';
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
import { RoomAdminMaintenanceService } from './services/room-admin-maintenance.service';
import { RoomLifecycleService } from './services/room-lifecycle.service';
import { RoomMembershipService } from './services/room-membership.service';
import { RoomRealtimeTrackerService } from './services/room-realtime-tracker.service';
import { RoomAutoCleanupService } from './services/room-auto-cleanup.service';
import { RoomMaintenanceSettingsService } from './services/room-maintenance-settings.service';
import { RoomPayloadCacheService } from './services/room-payload-cache.service';
import { RoomRuntimeStateService } from './services/room-runtime-state.service';
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
    RoomGatewayActionsService,
    RoomGatewayCommandService,
    RoomGatewayConnectionService,
    RoomGatewayLifecycleService,
    RoomGatewayPresenceService,
    RoomGatewaySessionService,
    RoomGatewayStateService,
    RoomInviteService,
    RoomLobbyRefreshService,
    RoomLobbyRefreshBinder,
    RoomAdminMaintenanceService,
    RoomLifecycleService,
    RoomMembershipService,
    RoomRealtimeTrackerService,
    RoomMaintenanceSettingsService,
    RoomPayloadCacheService,
    RoomRuntimeStateService,
    RoomAutoCleanupService,
    RoomLobbyWsHandler,
    RoomWsRegistrar,
  ],
  exports: [RoomService, RoomMaintenanceSettingsService],
})
export class RoomModule {}
