import { Injectable, OnModuleInit } from '@nestjs/common';
import { type WsSession } from '../../../../../realtime/public-api';
import { WsRouteRegistry } from '../../../../../realtime/public-api';
import { GameWsHandler } from './game-ws.handler';

@Injectable()
export class GameWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly handler: GameWsHandler,
  ) {}

  onModuleInit() {
    // Rules fetching: keep backward-compatible aliases.
    const rulesHandler = (session: WsSession, payload: unknown) =>
      this.handler.rules(session, payload);
    this.registry.register('game.rules', rulesHandler);
    this.registry.register('game.rules.get', rulesHandler);
    this.registry.register('game.rulebook', rulesHandler);
    this.registry.register('game.rulebook.get', rulesHandler);
    this.registry.register('rules', rulesHandler);

    this.registry.register('game.modules', (session) =>
      this.handler.modules(session),
    );
  }
}

