import { Module } from '@nestjs/common';
import { EffectsService } from '../features/effects/services/effects.service';
import { PendingRequirementService } from '../features/effects/services/pending-requirement.service';
import { StandEffectRegistryService } from '../features/effects/services/stand-effect-registry.service';
import { TileEffectRegistryService } from '../features/effects/services/tile-effect-registry.service';
import { GAME_MODULE_OVERVIEW } from '../../game-module-overview.constants';

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



