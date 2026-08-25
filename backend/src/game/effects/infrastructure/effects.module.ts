import { Module } from '@nestjs/common';
import { EffectsService } from '../application/services/effects.service';
import { PendingRequirementService } from '../application/services/pending-requirement.service';
import { StandEffectRegistryService } from '../application/services/stand-effect-registry.service';
import { TileEffectRegistryService } from '../application/services/tile-effect-registry.service';
import { GAME_MODULE_OVERVIEW } from '../../core/application/contracts/game-module-overview.contract';

const effectsOverviewProvider = {
  provide: GAME_MODULE_OVERVIEW,
  useExisting: EffectsService,
};

@Module({
  providers: [
    EffectsService,
    TileEffectRegistryService,
    PendingRequirementService,
    StandEffectRegistryService,
    effectsOverviewProvider,
  ],
  exports: [
    EffectsService,
    TileEffectRegistryService,
    PendingRequirementService,
    StandEffectRegistryService,
    effectsOverviewProvider,
  ],
})
export class EffectsModule {}



