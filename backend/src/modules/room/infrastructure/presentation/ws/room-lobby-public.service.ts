import { Inject, Injectable } from '@nestjs/common';
import { CatalogService } from '../../../../catalog/public-api';
import { stringOrEmpty } from '../../../../../shared/utils/public-api';
import {
  ROOM_LOBBY_REPOSITORY,
  type RoomLobbyRepository,
} from '../../../application/ports/room-lobby.repository';
import { RoomLobbyPolicyService } from '../../../application/services/room-lobby-policy.service';
import { RoomMembershipFacadeService } from '../../../application/services/room-membership-facade.service';
import { RoomRealtimeTrackerService } from '../../../application/services/room-realtime-tracker.service';
import { RoomStateService } from '../../../application/services/room-state.service';
import type {
  RoomsPublicJoinDto,
  RoomsPublicListDto,
} from './dto/rooms-public.ws.dto';
import { buildPublicRoomList } from './room-lobby-list.helpers';
import { RoomLobbyPresenter } from './room-lobby.presenter';
import type { LobbyUser, LobbyWsVariant } from './room-lobby.types';

type CatalogGameLike = { id: string; status?: unknown };

@Injectable()
export class RoomLobbyPublicService {
  constructor(
    private readonly membership: RoomMembershipFacadeService,
    private readonly roomState: RoomStateService,
    private readonly policy: RoomLobbyPolicyService,
    private readonly catalog: CatalogService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    private readonly presenter: RoomLobbyPresenter,
    @Inject(ROOM_LOBBY_REPOSITORY)
    private readonly lobbyRepo: RoomLobbyRepository,
  ) {}

  async list(
    user: LobbyUser,
    dto: RoomsPublicListDto,
    variant: LobbyWsVariant,
  ) {
    const isAdmin = Boolean(
      user.roles?.includes('ROLE_ADMIN') || user.roles?.includes('admin'),
    );
    const allowedGames = (await this.catalog.getAllGames()).filter((item) => {
      const game = item as CatalogGameLike;
      const status = (stringOrEmpty(game.status) || 'finished').toLowerCase();
      return status !== 'construction' || isAdmin;
    });
    const allowed = new Set(allowedGames.map((game) => game.id));
    if (!this.policy.ensureGameTypeAllowed(dto.gameType, allowed)) {
      return this.presenter.presentPublicList(variant, {
        items: [],
        groups: [],
      });
    }
    const rooms = await this.lobbyRepo.listPublicRooms({
      gameType: dto.gameType ?? null,
    });
    const activeRoomIds = new Set(
      this.realtimeTracker.getActivePlayerRoomIds(),
    );
    const built = buildPublicRoomList(
      rooms.filter((room) => activeRoomIds.has(room.id)),
      { allowedGameTypes: allowed },
    );
    const withBan = <T extends { id: number }>(room: T) => ({
      ...room,
      banned: this.roomState.isBanned(room.id, user.id),
    });
    built.items = built.items.map(withBan);
    built.groups = built.groups.map((group) => ({
      ...group,
      rooms: group.rooms.map(withBan),
    }));
    return this.presenter.presentPublicList(variant, built);
  }

  async join(
    user: LobbyUser,
    dto: RoomsPublicJoinDto,
    variant: LobbyWsVariant,
  ) {
    this.policy.ensureNotBanned(this.roomState.isBanned(dto.roomId, user.id));
    await this.membership.joinRoom(dto.roomId, user.id);
    const state = await this.roomState.getRoomPayload(dto.roomId);
    return this.presenter.presentJoinResult(
      variant,
      'joined',
      dto.roomId,
      state.room,
    );
  }

  async leave(
    user: LobbyUser,
    dto: RoomsPublicJoinDto,
    variant: LobbyWsVariant,
  ) {
    const room = await this.membership.leaveRoom(dto.roomId, user.id);
    if (!room) {
      return this.presenter.presentJoinResult(
        variant,
        'left',
        dto.roomId,
        undefined,
        true,
      );
    }
    const state = await this.roomState.getRoomPayload(dto.roomId);
    return this.presenter.presentJoinResult(
      variant,
      'left',
      dto.roomId,
      state.room,
    );
  }

  async spectate(dto: RoomsPublicJoinDto, variant: LobbyWsVariant) {
    const state = await this.roomState.getRoomPayload(dto.roomId);
    this.policy.ensureSpectatingAllowed(state);
    return this.presenter.presentJoinResult(
      variant,
      'spectated',
      dto.roomId,
      state.room,
    );
  }
}
