import { ROOM_GAME_RUN_READER } from '../application/ports/room-game-run-reader.port';
import { RoomGameRunTypeormReader } from '../infrastructure/persistence/typeorm/repositories/room-game-run-typeorm.reader';
import { RoomGameAccessService } from '../application/services/membership/room-game-access.service';
import { ROOM_BOTS_REPOSITORY } from '../application/ports/room-bots.repository';
import { RoomBotsTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/room-bots-typeorm.repository';
import { ConfigService } from '@nestjs/config';
import { ACTIVE_ROOM_PARTICIPANTS_READER } from '../application/ports/active-room-participants-reader.port';
import { ActiveRoomParticipantsTypeormReader } from '../infrastructure/persistence/typeorm/repositories/active-room-participants-typeorm.reader';
import { RoomAdminMaintenanceService } from '../application/services/maintenance/room-admin-maintenance.service';
import { RoomAccessService } from '../application/services/membership/room-access.service';
import { RoomAdminContextService } from '../application/services/maintenance/room-admin-context.service';
import { RoomClientPolicyService } from '../application/services/membership/room-client-policy.service';
import { RoomAdminPolicyService } from '../application/services/maintenance/room-admin-policy.service';
import { RoomAutoCleanupService } from '../application/services/lifecycle/room-auto-cleanup.service';
import { RoomInviteService } from '../application/services/membership/room-invite.service';
import { ROOM_INVITE_REPOSITORY } from '../application/ports/room-invite.repository';
import { RoomInviteTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/room-invite-typeorm.repository';
import { RoomJoinPolicyService } from '../application/services/membership/room-join-policy.service';
import { RoomLobbyPolicyService } from '../application/services/lobby/room-lobby-policy.service';
import { RoomLifecycleFacadeService } from '../application/services/lifecycle/room-lifecycle-facade.service';
import { RoomLifecycleService } from '../application/services/lifecycle/room-lifecycle.service';
import { RoomLobbyRefreshBinder } from '../application/services/lobby/room-lobby-refresh.binder';
import { RoomLobbyRefreshService } from '../application/services/lobby/room-lobby-refresh.service';
import { ROOM_ADMIN_PORT } from '../application/ports/room-admin.port';
import { RoomMaintenanceSettingsService } from '../application/services/maintenance/room-maintenance-settings.service';
import { RoomMembershipFacadeService } from '../application/services/membership/room-membership-facade.service';
import { RoomMembershipService } from '../application/services/membership/room-membership.service';
import { RoomLeaveService } from '../application/services/membership/room-leave.service';
import { RoomEmptyCleanupService } from '../application/services/lifecycle/room-empty-cleanup.service';
import { RoomPayloadBuilderService } from '../application/services/state/room-payload-builder.service';
import { RoomPayloadService } from '../application/services/state/room-payload.service';
import { RoomStateService } from '../application/services/state/room-state.service';
import { ROOM_EVENT_PUBLISHER } from '../application/ports/room-event-publisher.port';
import { ROOM_EVENTS_PORT } from '../application/ports/room-events.port';
import { ROOM_GAME_PORT } from '../application/ports/room-game.port';
import { ROOM_MAINTENANCE_DEFAULTS } from '../application/ports/room-maintenance-defaults.port';
import { ROOM_MAINTENANCE_SETTINGS_REPOSITORY } from '../application/ports/room-maintenance-settings.repository';
import { ROOM_LOBBY_REPOSITORY } from '../application/ports/room-lobby.repository';
import { ROOM_PARTICIPANT_REPOSITORY } from '../application/ports/room-participant.repository';
import { ROOM_PAYLOAD_CACHE } from '../application/ports/room-payload-cache.port';
import { ROOM_REPOSITORY } from '../application/ports/room.repository';
import { ROOM_PAYLOAD_READER } from '../application/ports/room-payload.reader';
import { ROOM_VAULT_PORT } from '../application/ports/room-vault.port';
import { ROOM_USER_REPOSITORY } from '../application/ports/room-user.repository';
import { RoomPayloadCacheService } from '../infrastructure/cache/room-payload-cache.service';
import { RoomRealtimeTrackerService } from '../application/services/state/room-realtime-tracker.service';
import { RoomRuntimeStateService } from '../application/services/state/room-runtime-state.service';
import { RoomAdminAdapter } from '../infrastructure/public/room-admin.adapter';
import { RoomGameAdapter } from '../infrastructure/public/room-game.adapter';
import { RoomVaultAdapter } from '../infrastructure/public/room-vault.adapter';
import { RoomMaintenanceSettingsTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/room-maintenance-settings-typeorm.repository';
import { RoomLobbyTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/room-lobby-typeorm.repository';
import { RoomParticipantTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/room-participant-typeorm.repository';
import { RoomTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/room-typeorm.repository';
import { RoomPayloadTypeormReader } from '../infrastructure/persistence/typeorm/repositories/room-payload-typeorm.reader';
import { RoomUserTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/room-user-typeorm.repository';
import { RoomEventsBusService } from '../infrastructure/system/room-events-bus.service';
import { createRoomMaintenanceDefaults } from '../infrastructure/config/room-maintenance-defaults.config';

export const ROOM_CORE_PROVIDERS = [
  RoomGameRunTypeormReader,
  RoomInviteTypeormRepository,
  { provide: ROOM_INVITE_REPOSITORY, useExisting: RoomInviteTypeormRepository },
  { provide: ROOM_GAME_RUN_READER, useExisting: RoomGameRunTypeormReader },
  RoomBotsTypeormRepository,
  { provide: ROOM_BOTS_REPOSITORY, useExisting: RoomBotsTypeormRepository },
  ActiveRoomParticipantsTypeormReader,
  {
    provide: ACTIVE_ROOM_PARTICIPANTS_READER,
    useExisting: ActiveRoomParticipantsTypeormReader,
  },
  RoomEventsBusService,
  RoomAdminAdapter,
  RoomGameAdapter,
  RoomGameAccessService,
  RoomVaultAdapter,
  RoomTypeormRepository,
  RoomPayloadTypeormReader,
  RoomLobbyTypeormRepository,
  RoomParticipantTypeormRepository,
  RoomUserTypeormRepository,
  RoomMaintenanceSettingsTypeormRepository,
  {
    provide: ROOM_EVENT_PUBLISHER,
    useExisting: RoomEventsBusService,
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
    provide: ROOM_PAYLOAD_READER,
    useExisting: RoomPayloadTypeormReader,
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
  RoomLeaveService,
  RoomEmptyCleanupService,
  RoomPayloadBuilderService,
  RoomPayloadService,
  RoomStateService,
  RoomRealtimeTrackerService,
  RoomMaintenanceSettingsService,
  RoomPayloadCacheService,
  RoomRuntimeStateService,
  RoomAutoCleanupService,
];
