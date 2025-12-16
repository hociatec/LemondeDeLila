import { Module } from '@nestjs/common';
import { CatalogService } from './services/catalog.service';
import { GameRegistryModule } from '../game/engine/game-registry.module';
import { CatalogWsHandler } from './ws/catalog-ws.handler';
import { CatalogWsRegistrar } from './ws/catalog-ws.registrar';

@Module({
  imports: [GameRegistryModule],
  providers: [CatalogService, CatalogWsHandler, CatalogWsRegistrar],
  exports: [CatalogService],
})
export class CatalogModule {}
