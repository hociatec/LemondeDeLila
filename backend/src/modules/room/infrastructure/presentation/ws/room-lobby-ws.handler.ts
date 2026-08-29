import { ForbiddenException, Injectable } from '@nestjs/common';
import { PayloadValidationService } from '../../../../../platform/validation/public-api';
import {
  requireUser,
  type WsSession,
} from '../../../../../platform/realtime/public-api';
import { RoomLobbyRefreshService } from '../../../application/services/room-lobby-refresh.service';
import {
  RoomInvitePresenceListDto,
  RoomInviteRespondDto,
  RoomInviteSendDto,
} from './dto/room-invite.ws.dto';
import {
  RoomsPublicJoinDto,
  RoomsPublicListDto,
} from './dto/rooms-public.ws.dto';
import { RoomLobbyInvitesService } from './room-lobby-invites.service';
import { RoomLobbyPublicService } from './room-lobby-public.service';
import { RoomLobbyPresenter } from './room-lobby.presenter';
import type { LobbyWsVariant } from './room-lobby.types';

@Injectable()
export class RoomLobbyWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly lobbyRefresh: RoomLobbyRefreshService,
    private readonly publicLobby: RoomLobbyPublicService,
    private readonly invitations: RoomLobbyInvitesService,
    private readonly presenter: RoomLobbyPresenter,
  ) {}

  listPublic(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomsPublicListDto, payload);
    return this.publicLobby.list(user, dto, variant);
  }

  joinPublic(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomsPublicJoinDto, payload);
    return this.publicLobby.join(user, dto, variant);
  }

  leavePublic(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomsPublicJoinDto, payload);
    return this.publicLobby.leave(user, dto, variant);
  }

  spectatePublic(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    requireUser(session);
    const dto = this.validator.validate(RoomsPublicJoinDto, payload);
    return this.publicLobby.spectate(dto, variant);
  }

  async subscribePublic(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const connectionId = this.requireConnectionId(session);
    const dto = this.validator.validate(RoomsPublicListDto, payload);
    this.lobbyRefresh.subscribe(connectionId, dto.gameType ?? null, variant);
    const listed = await this.publicLobby.list(user, dto, variant);
    return this.presenter.presentSubscription(
      variant,
      'subscribed',
      listed.payload,
    );
  }

  async unsubscribePublic(
    session: WsSession,
    variant: LobbyWsVariant = 'legacy',
  ) {
    requireUser(session);
    this.lobbyRefresh.unsubscribe(this.requireConnectionId(session));
    return this.presenter.presentSubscription(variant, 'unsubscribed', {
      ok: true,
    });
  }

  inviteSend(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomInviteSendDto, payload);
    return this.invitations.send(user, dto, variant);
  }

  invitePresenceList(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(
      RoomInvitePresenceListDto,
      payload ?? {},
    );
    return this.invitations.listPresence(user, dto, variant);
  }

  inviteRespond(
    session: WsSession,
    payload: unknown,
    variant: LobbyWsVariant = 'legacy',
  ) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomInviteRespondDto, payload);
    return this.invitations.respond(user, dto, variant);
  }

  private requireConnectionId(session: WsSession): string {
    const connectionId = session.connectionId?.trim();
    if (!connectionId) {
      throw new ForbiddenException('Session WS invalide');
    }
    return connectionId;
  }
}
