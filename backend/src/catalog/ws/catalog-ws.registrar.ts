import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { CatalogWsHandler } from './catalog-ws.handler';

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

    // Warm-up du cache catalogue pour éviter un premier `catalog.all` très lent.
    this.handler
      .games()
      .then((res) =>
        this.logger.log(
          `Warm-up catalogue effectué (${(res as any)?.payload?.length ?? 'n/a'} jeux)`,
        ),
      )
      .catch((err) =>
        this.logger.warn(
          `Warm-up catalogue échoué: ${(err as Error)?.message ?? err}`,
        ),
      );
  }
}
