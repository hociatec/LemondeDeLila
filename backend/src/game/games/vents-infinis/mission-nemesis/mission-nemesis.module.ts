import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { MissionNemesisService } from './mission-nemesis.service';
import { MissionNemesisSetupService } from './setup/mission-nemesis-setup.service';
import { MissionNemesisActionService } from './actions/mission-nemesis-action.service';
import { MissionNemesisPhaseService } from './phases/mission-nemesis-phase.service';
import { MissionNemesisPresenterService } from './presenter/mission-nemesis-presenter.service';

@Module({
  imports: [ConfigModule, GameCoreModule, GameRegistryModule],
  providers: [
    MissionNemesisService,
    MissionNemesisSetupService,
    MissionNemesisActionService,
    MissionNemesisPhaseService,
    MissionNemesisPresenterService,
  ],
  exports: [MissionNemesisService],
})
export class MissionNemesisModule {}
