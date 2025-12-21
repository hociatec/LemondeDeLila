import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../../core/core.module';
import { GameRegistryModule } from '../../../../engine/game-registry.module';
import { PetitChevauxService } from './petit-chevaux.service';
import { PetitChevauxSetupService } from './setup/petit-chevaux-setup.service';
import { PetitChevauxActionService } from './actions/petit-chevaux-action.service';
import { PetitChevauxPhaseService } from './phases/petit-chevaux-phase.service';
import { PetitChevauxPresenterService } from './presenter/petit-chevaux-presenter.service';

@Module({
  imports: [GameCoreModule, GameRegistryModule],
  providers: [
    PetitChevauxService,
    PetitChevauxSetupService,
    PetitChevauxActionService,
    PetitChevauxPhaseService,
    PetitChevauxPresenterService,
  ],
  exports: [PetitChevauxService],
})
export class PetitChevauxModule {}
