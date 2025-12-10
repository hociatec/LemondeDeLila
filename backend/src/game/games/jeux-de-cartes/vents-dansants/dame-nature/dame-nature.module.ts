import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../../core/core.module';
import { CardsModule } from '../../../../modules/cards/cards.module';
import { TurnModule } from '../../../../modules/turn/turn.module';
import { DameNatureService } from './services/dame-nature.service';

@Module({
  imports: [GameCoreModule, CardsModule, TurnModule],
  providers: [DameNatureService],
  exports: [DameNatureService],
})
export class DameNatureModule {}
