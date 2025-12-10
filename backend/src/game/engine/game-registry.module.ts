import { Module } from '@nestjs/common';
import { GameRegistryService } from './services/game-registry.service';
import { PanierExpressModule } from '../games/jeux-de-plateaux/les-quatre-vents/panier-express/panier-express.module';
import { DameNatureModule } from '../games/jeux-de-cartes/vents-dansants/dame-nature/dame-nature.module';

@Module({
  imports: [PanierExpressModule, DameNatureModule],
  providers: [GameRegistryService],
  exports: [GameRegistryService],
})
export class GameRegistryModule {}
