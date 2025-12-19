import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../../common/ws/ws-route-registry.service';
import { GameWsHandler } from './game-ws.handler';

@Injectable()
export class GameWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly handler: GameWsHandler,
  ) {}

  onModuleInit() {
    this.registry.register('game.rules', (session, payload) => this.handler.rules(session, payload));
    this.registry.register('game.modules', (session) => this.handler.modules(session));
  }
}
