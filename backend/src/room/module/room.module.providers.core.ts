import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoomAdminMaintenanceService } from '../application/services/room-admin-maintenance.service';
import { RoomAccessService } from '../application/services/room-access.service';
import { RoomAdminContextService } from '../application/services/room-admin-context.service';
import { RoomClientPolicyService } from '../application/services/room-client-policy.service';
import { RoomAdminPolicyService } from '../application/services/room-admin-policy.service';
import { RoomAutoCleanupService } from '../application/services/room-auto-cleanup.service';
import { RoomInviteService } from '../application/services/room-invite.service';
import { RoomJoinPolicyService } from '../application/services/room-join-policy.service';
import { RoomLobbyPolicyService } from '../application/services/room-lobby-policy.service';
import { RoomLifecycleFacadeService } from '../application/services/room-lifecycle-facade.service';
import { RoomLifecycleService } from '../application/services/room-lifecycle.service';
import { RoomLobbyRefreshBinder } from '../application/services/room-lobby-refresh.binder';
import { RoomLobbyRefreshService } from '../application/services/room-lobby-refresh.service';
import { ROOM_ADMIN_PORT } from '../application/ports/room-admin.port';
import { RoomMaintenanceSettingsService } from '../application/services/room-maintenance-settings.service';
import { RoomMembershipFacadeService } from '../application/services/room-membership-facade.service';
import { RoomMembershipService } from '../application/services/room-membership.service';
import { RoomPayloadBuilderService } from '../application/services/room-payload-builder.service';
import { RoomPayloadService } from '../application/services/room-payload.service';
import { RoomStateService } from '../application/services/room-state.service';
import { ROOM_EVENT_PUBLISHER } from '../application/ports/room-event-publisher.port';
import { ROOM_EVENTS_PORT } from '../application/ports/room-events.port';
import { ROOM_GAME_PORT } from '../application/ports/room-game.port';
import { ROOM_MAINTENANCE_DEFAULTS } from '../application/ports/room-maintenance-defaults.port';
import { ROOM_MAINTENANCE_SETTINGS_REPOSITORY } from '../application/ports/room-maintenance-settings.repository';
import { ROOM_LOBBY_REPOSITORY } from '../application/ports/room-lobby.repository';
import { ROOM_PARTICIPANT_REPOSITORY } from '../application/ports/room-participant.repository';
import { ROOM_PAYLOAD_CACHE } from '../application/ports/room-payload-cache.port';
import { ROOM_REPOSITORY } from '../application/ports/room.repository';
import { ROOM_VAULT_PORT } from '../application/ports/room-vault.port';
import { ROOM_USER_REPOSITORY } from '../application/ports/room-user.repository';
import { ROOM_VAULT_SNAPSHOT_REPOSITORY } from '../application/ports/room-vault-snapshot.repository';
import { RoomPayloadCacheService } from '../infrastructure/cache/room-payload-cache.service';
import { RoomRealtimeTrackerService } from '../application/services/room-realtime-tracker.service';
import { RoomRuntimeStateService } from '../application/services/room-runtime-state.service';
import { RoomAdminAdapter } from '../infrastructure/public/room-admin.adapter';
import { RoomGameAdapter } from '../infrastructure/public/room-game.adapter';
import { RoomVaultAdapter } from '../infrastructure/public/room-vault.adapter';
import { RoomMaintenanceSettingsTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/room-maintenance-settings-typeorm.repository';
import { RoomLobbyTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/room-lobby-typeorm.repository';
import { RoomParticipantTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/room-participant-typeorm.repository';
import { RoomTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/room-typeorm.repository';
import { RoomUserTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/room-user-typeorm.repository';
import { VaultRoomSnapshotEntity } from '../../vault/infrastructure/persistence/typeorm/entities/vault-room-snapshot.entity';
import {
  ROOM_VAULT_SNAPSHOTS_TYPEORM_REPOSITORY,
  RoomVaultSnapshotTypeormRepository,
} from '../infrastructure/persistence/typeorm/repositories/room-vault-snapshot-typeorm.repository';
import { RoomEventPublisherAdapter } from '../infrastructure/system/room-event-publisher.adapter';
import { RoomEventsBusService } from '../infrastructure/system/room-events-bus.service';
import { createRoomMaintenanceDefaults } from '../infrastructure/config/room-maintenance-defaults.config';

export const ROOM_CORE_PROVIDERS = [
  {
    provide: ROOM_VAULT_SNAPSHOTS_TYPEORM_REPOSITORY,
    useExisting: getRepositoryToken(VaultRoomSnapshotEntity),
  },
  RoomEventsBusService,
  RoomEventPublisherAdapter,
  RoomAdminAdapter,
  RoomGameAdapter,
  RoomVaultAdapter,
  RoomTypeormRepository,
  RoomLobbyTypeormRepository,
  RoomParticipantTypeormRepository,
  RoomUserTypeormRepository,
  RoomVaultSnapshotTypeormRepository,
  RoomMaintenanceSettingsTypeormRepository,
  {
    provide: ROOM_EVENT_PUBLISHER,
    useExisting: RoomEventPublisherAdapter,
  },
  {
    provide: ROOM_EVENTS_PORT,
    useExisting: RoomEventsBusService,
  },
  {
    provide: ROOM_ADMIN_PORT,
    useExisting: RoomAdminAdapter,
  },
  {
    provide: ROOM_GAME_PORT,
    useExisting: RoomGameAdapter,
  },
  {
    provide: ROOM_VAULT_PORT,
    useExisting: RoomVaultAdapter,
  },
  {
    provide: ROOM_REPOSITORY,
    useExisting: RoomTypeormRepository,
  },
  {
    provide: ROOM_LOBBY_REPOSITORY,
    useExisting: RoomLobbyTypeormRepository,
  },
  {
    provide: ROOM_PARTICIPANT_REPOSITORY,
    useExisting: RoomParticipantTypeormRepository,
  },
  {
    provide: ROOM_USER_REPOSITORY,
    useExisting: RoomUserTypeormRepository,
  },
  {
    provide: ROOM_VAULT_SNAPSHOT_REPOSITORY,
    useExisting: RoomVaultSnapshotTypeormRepository,
  },
  {
    provide: ROOM_MAINTENANCE_SETTINGS_REPOSITORY,
    useExisting: RoomMaintenanceSettingsTypeormRepository,
  },
  {
    provide: ROOM_PAYLOAD_CACHE,
    useExisting: RoomPayloadCacheService,
  },
  {
    provide: ROOM_MAINTENANCE_DEFAULTS,
    inject: [ConfigService],
    useFactory: createRoomMaintenanceDefaults,
  },
  RoomInviteService,
  RoomJoinPolicyService,
  RoomLobbyPolicyService,
  RoomClientPolicyService,
  RoomLobbyRefreshService,
  RoomLobbyRefreshBinder,
  RoomAdminPolicyService,
  RoomAdminContextService,
  RoomAccessService,
  RoomAdminMaintenanceService,
  RoomLifecycleFacadeService,
  RoomLifecycleService,
  RoomMembershipFacadeService,
  RoomMembershipService,
  RoomPayloadBuilderService,
  RoomPayloadService,
  RoomStateService,
  RoomRealtimeTrackerService,
  RoomMaintenanceSettingsService,
  RoomPayloadCacheService,
  RoomRuntimeStateService,
  RoomAutoCleanupService,
];
