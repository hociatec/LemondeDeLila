import { Module } from '@nestjs/common';
import { GameRegistryService } from './services/game-registry.service';
import { PanierExpressModule } from '../games/jeux-de-plateaux/les-quatre-vents/panier-express/panier-express.module';

@Module({
  imports: [PanierExpressModule],
  providers: [GameRegistryService],
  exports: [GameRegistryService],
})
export class GameRegistryModule {}
