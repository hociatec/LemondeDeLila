import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { CatalogWsHandler } from './catalog-ws.handler';

@Injectable()
export class CatalogWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly handler: CatalogWsHandler,
  ) {}

  onModuleInit() {
    this.registry.register('catalog.all', () => this.handler.all());
    this.registry.register('catalog.categories', () =>
      this.handler.categories(),
    );
    this.registry.register('catalog.categoryGames', (_, payload) =>
      this.handler.categoryGames(payload),
    );
    this.registry.register('catalog.games', () => this.handler.games());
  }
}
