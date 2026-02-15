import { Module } from '@nestjs/common';
import { EffectsService } from './services/effects.service';
import { TileEffectRegistryService } from './services/tile-effect-registry.service';
import { PendingRequirementService } from './services/pending-requirement.service';
import { StandEffectRegistryService } from './services/stand-effect-registry.service';
import { GAME_MODULE_OVERVIEW } from '../game-module-overview.constants';

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
