import { Module } from '@nestjs/common';
import { CatalogService } from './services/catalog.service';
import { GameRegistryModule } from '../game/engine/game-registry.module';

@Module({
  imports: [GameRegistryModule],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
