import { Injectable } from '@nestjs/common';
import { requireUser } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { GameContentService } from '../../../engine/public-api';
import { GameModuleOverviewRegistryService } from '../../../application/services/game-module-overview.service';
import { GameRulesDto } from './dto/game-rules.ws.dto';

@Injectable()
export class GameWsHandler {
  constructor(
    private readonly content: GameContentService,
    private readonly overviewRegistry: GameModuleOverviewRegistryService,
    private readonly validator: PayloadValidationService,
  ) {}

  async rules(session: WsSession, payload: unknown) {
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



