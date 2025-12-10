import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../../core/core.module';
import { CardsModule } from '../../../../modules/cards/cards.module';
import { TurnModule } from '../../../../modules/turn/turn.module';
import { BoardModule } from '../../../../modules/board/board.module';
import { EffectsModule } from '../../../../modules/effects/effects.module';
import { PanierExpressService } from './services/panier-express.service';

@Module({
  imports: [GameCoreModule, CardsModule, TurnModule, BoardModule, EffectsModule],
  providers: [PanierExpressService],
  exports: [PanierExpressService],
})
export class PanierExpressModule {}
