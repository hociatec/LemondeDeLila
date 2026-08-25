import { GameWsCommandMapper } from './game-ws-command.mapper';
import { GameWsHandler } from './game-ws.handler';
import { GameWsPayloadCompatibilityAdapter } from './game-ws-payload-compatibility.adapter';
import { GameWsRealtimeStateService } from './game-ws-realtime-state.service';
import { GameWsRegistrar } from './game-ws.registrar';
import { GameWsRoomContextService } from './game-ws-room-context.service';
import { GameWsStatePresenter } from './game-ws-state.presenter';
import { GameRoomLifecycleResetBinder } from './game-room-lifecycle-reset.binder';

export const GAME_WS_PRESENTATION_PROVIDERS = [
  GameWsCommandMapper,
  GameWsHandler,
  GameWsPayloadCompatibilityAdapter,
  GameWsRealtimeStateService,
  GameWsRegistrar,
  GameWsRoomContextService,
  GameWsStatePresenter,
  GameRoomLifecycleResetBinder,
];
