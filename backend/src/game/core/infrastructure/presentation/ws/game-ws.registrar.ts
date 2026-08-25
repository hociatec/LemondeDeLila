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

    this.registry.register('game.state', (session, payload) =>
      this.handler.state(session, payload),
    );
    this.registry.register('game.state.get', (session, payload) =>
      this.handler.state(session, payload),
    );
    this.registry.register('game.join', (session, payload) =>
      this.handler.join(session, payload),
    );
    this.registry.register('game.turn', (session, payload) =>
      this.handler.turn(session, payload),
    );
    this.registry.register('game.ping', (session, payload) =>
      this.handler.ping(session, payload),
    );
    this.registry.register('game.action', (session, payload) =>
      this.handler.action(session, payload),
    );
    this.registry.register('game.actions', (session, payload) =>
      this.handler.action(session, payload),
    );
    this.registry.register('game.actions.apply', (session, payload) =>
      this.handler.action(session, payload),
    );
    this.registry.register('game.key', (session, payload) =>
      this.handler.key(session, payload),
    );
  }
}
