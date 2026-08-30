import { GameWsCommandMapper } from './game-ws-command.mapper';
import { GameWsHandler } from './game-ws.handler';
import { GameWsRealtimeStateService } from './state/game-ws-realtime-state.service';
import { GameWsRegistrar } from './game-ws.registrar';
import { GameWsRoomContextService } from './game-ws-room-context.service';
import { GameWsStatePresenter } from './state/game-ws-state.presenter';
import { GameRoomLifecycleResetBinder } from './game-room-lifecycle-reset.binder';
import { GameWsCatalogPresenter } from './game-ws-catalog.presenter';

export const GAME_WS_PRESENTATION_PROVIDERS = [
  GameWsCommandMapper,
  GameWsCatalogPresenter,
  GameWsHandler,
  GameWsRealtimeStateService,
  GameWsRegistrar,
  GameWsRoomContextService,
  GameWsStatePresenter,
  GameRoomLifecycleResetBinder,
];
