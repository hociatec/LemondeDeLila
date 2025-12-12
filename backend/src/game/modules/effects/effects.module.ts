import { Module } from '@nestjs/common';
import { EffectsService } from './services/effects.service';
import { TileEffectRegistryService } from './services/tile-effect-registry.service';
import { PendingRequirementService } from './services/pending-requirement.service';
import { StandEffectRegistryService } from './services/stand-effect-registry.service';

@Module({
  providers: [EffectsService, TileEffectRegistryService, PendingRequirementService, StandEffectRegistryService],
  exports: [EffectsService, TileEffectRegistryService, PendingRequirementService, StandEffectRegistryService],
})
export class EffectsModule {}
