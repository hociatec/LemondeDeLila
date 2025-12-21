import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../../core/core.module';
import { GameRegistryModule } from '../../../../engine/game-registry.module';
import { VoteModule } from '../../../../modules/vote/vote.module';
import { RolesModule } from '../../../../modules/roles/roles.module';
import { PlayerModule } from '../../../../modules/player/player.module';
import { TurnModule } from '../../../../modules/turn/turn.module';
import { ActionLogModule } from '../../../../modules/actionlog/actionlog.module';
import { ActionResolverModule } from '../../../../modules/action-resolver/action-resolver.module';
import { StateModule } from '../../../../modules/state/state.module';
import { BotModule } from '../../../../modules/bot/bot.module';
import { VictoryModule } from '../../../../modules/victory/victory.module';
import { LoupGarouService } from './loup-garou.service';
import { LoupGarouSetupService } from './setup/loup-garou-setup.service';
import { LoupGarouPhaseService } from './phases/loup-garou-phase.service';
import { LoupGarouActionService } from './actions/loup-garou-action.service';
import { LoupGarouBotService } from './bots/loup-garou-bot.service';
import { LoupGarouPresenterService } from './presenter/loup-garou-presenter.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    VoteModule,
    RolesModule,
    PlayerModule,
    TurnModule,
    ActionLogModule,
    StateModule,
    VictoryModule,
    BotModule,
  ],
  providers: [
    LoupGarouService,
    LoupGarouSetupService,
    LoupGarouPhaseService,
    LoupGarouActionService,
    LoupGarouBotService,
    LoupGarouPresenterService,
  ],
  exports: [LoupGarouService],
})
export class LoupGarouModule {}
