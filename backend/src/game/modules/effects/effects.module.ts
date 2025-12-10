import { Module } from '@nestjs/common';
import { EffectsService } from './services/effects.service';
import { TileEffectRegistryService } from './services/tile-effect-registry.service';
import { PendingRequirementService } from './services/pending-requirement.service';

@Module({
  providers: [EffectsService, TileEffectRegistryService, PendingRequirementService],
  exports: [EffectsService, TileEffectRegistryService, PendingRequirementService],
})
export class EffectsModule {}
