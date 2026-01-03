import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { StatsWsHandler } from './stats-ws.handler';

@Injectable()
export class StatsWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly handler: StatsWsHandler,
  ) {}

  onModuleInit() {
    this.registry.register('stats.my', (session) => this.handler.my(session));
    this.registry.register('stats.user', (session, payload) => this.handler.user(session, payload));
    this.registry.register('leaderboard.games', () => this.handler.leaderboardGames());
    this.registry.register('leaderboard.top', (_, payload) => this.handler.leaderboardTop(payload));
  }
}
