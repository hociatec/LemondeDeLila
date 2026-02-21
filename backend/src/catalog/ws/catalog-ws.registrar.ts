import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { CatalogWsHandler } from './catalog-ws.handler';

type CatalogGamesResponse = { payload?: unknown };

@Injectable()
export class CatalogWsRegistrar implements OnModuleInit {
  private readonly logger = new Logger(CatalogWsRegistrar.name);

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

    // Warm-up du cache catalogue pour eviter un premier `catalog.all` tres lent.
    this.handler
      .games()
      .then((res) => {
        const payload = (res as CatalogGamesResponse).payload;
        const count = Array.isArray(payload) ? payload.length : 'n/a';
        this.logger.log(`Warm-up catalogue effectue (${count} jeux)`);
      })
      .catch((err) =>
        this.logger.warn(
          `Warm-up catalogue echoue: ${(err as Error)?.message ?? err}`,
        ),
      );
  }
}
