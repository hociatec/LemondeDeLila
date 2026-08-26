import { RoomGatewayActionsService } from '../infrastructure/presentation/ws/room-gateway-actions.service';
import { RoomGatewayBotActionsService } from '../infrastructure/presentation/ws/room-gateway-bot-actions.service';
import { RoomGatewayCommandService } from '../infrastructure/presentation/ws/room-gateway-command.service';
import { RoomGatewayConnectionService } from '../infrastructure/presentation/ws/room-gateway-connection.service';
import { RoomGatewayContextService } from '../infrastructure/presentation/ws/room-gateway-context.service';
import { RoomGatewayDispatcherService } from '../infrastructure/presentation/ws/room-gateway-dispatcher.service';
import { RoomGatewayLifecycleService } from '../infrastructure/presentation/ws/room-gateway-lifecycle.service';
import { RoomGatewayLifecyclePresenter } from '../infrastructure/presentation/ws/room-gateway-lifecycle.presenter';
import { RoomGatewayPresenter } from '../infrastructure/presentation/ws/room-gateway.presenter';
import { RoomGatewayStatePresenter } from '../infrastructure/presentation/ws/room-gateway-state.presenter';
import { RoomLobbyPresenter } from '../infrastructure/presentation/ws/room-lobby.presenter';
import { RoomGatewayPresenceService } from '../infrastructure/presentation/ws/room-gateway-presence.service';
import { RoomGatewaySessionPresenter } from '../infrastructure/presentation/ws/room-gateway-session.presenter';
import { RoomGatewaySessionService } from '../infrastructure/presentation/ws/room-gateway-session.service';
import { RoomGatewayStateService } from '../infrastructure/presentation/ws/room-gateway-state.service';
import { RoomGatewayRuntimeStateService } from '../infrastructure/presentation/ws/room-gateway-runtime-state.service';
import { RoomGateway } from '../infrastructure/presentation/ws/room.gateway';
import { RoomLobbyWsHandler } from '../infrastructure/presentation/ws/room-lobby-ws.handler';
import { RoomLobbyInvitesService } from '../infrastructure/presentation/ws/room-lobby-invites.service';
import { RoomLobbyPublicService } from '../infrastructure/presentation/ws/room-lobby-public.service';
import { RoomWsRegistrar } from '../infrastructure/presentation/ws/room-ws.registrar';

export const ROOM_PRESENTATION_PROVIDERS = [
  RoomGateway,
  RoomGatewayActionsService,
  RoomGatewayBotActionsService,
  RoomGatewayCommandService,
  RoomGatewayConnectionService,
  RoomGatewayContextService,
  RoomGatewayDispatcherService,
  RoomGatewayLifecycleService,
  RoomGatewayLifecyclePresenter,
  RoomGatewayPresenter,
  RoomGatewayStatePresenter,
  RoomLobbyPresenter,
  RoomGatewayPresenceService,
  RoomGatewaySessionPresenter,
  RoomGatewaySessionService,
  RoomGatewayStateService,
  RoomGatewayRuntimeStateService,
  RoomLobbyWsHandler,
  RoomLobbyInvitesService,
  RoomLobbyPublicService,
  RoomWsRegistrar,
];
