import { Injectable } from '@nestjs/common';
import { requireUser } from '../../../common/ws/ws-auth';
import type { WsSession } from '../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../common/validation/payload-validation.service';
import { GameContentService } from '../../engine/services/game-content.service';
import { GameModuleOverviewRegistryService } from '../../modules/game-module-overview.service';
import { GameRulesDto } from '../dto/game-rules.dto';

@Injectable()
export class GameWsHandler {
  constructor(
    private readonly content: GameContentService,
    private readonly overviewRegistry: GameModuleOverviewRegistryService,
    private readonly validator: PayloadValidationService,
  ) {}

  async rules(session: WsSession, payload: any) {
    requireUser(session);
    const dto = this.validator.validate(GameRulesDto, payload);
    const gameType = dto.gameType;
    const rules = await this.content.getRules(gameType);
    return { type: 'game.rules', payload: { rules, gameType } };
  }

  async modules(session: WsSession) {
    requireUser(session);
    const modules = this.overviewRegistry.getModules();
    return { type: 'game.modules', payload: { modules } };
  }
}
