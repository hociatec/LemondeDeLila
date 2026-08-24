import { GameWsHandler } from './game-ws.handler';
import { GameWsRegistrar } from './game-ws.registrar';

export const GAME_WS_PRESENTATION_PROVIDERS = [
  GameWsHandler,
  GameWsRegistrar,
];
