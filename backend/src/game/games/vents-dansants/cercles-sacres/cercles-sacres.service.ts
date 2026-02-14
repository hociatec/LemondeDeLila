import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { AbstractGameService } from '../../../engine/abstract/abstract-game.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../engine/shortcuts/game-shortcuts';
import * as Rulebook from './rulebook/rulebook';
import { CerclesSacresActionService } from './actions/cercles-sacres-action.service';
import { CerclesSacresPresenterService } from './presenter/cercles-sacres-presenter.service';
import { CerclesSacresSetupService } from './setup/cercles-sacres-setup.service';
import { CerclesSacresBotService } from './bots/cercles-sacres-bot.service';
import { CERCLES_SACRES_GAME } from './definitions/game.definition';
import { buildCerclesSacresShortcuts } from './cercles-sacres.shortcuts';

@Injectable()
export class CerclesSacresService extends AbstractGameService {
  readonly gameType = 'cercles-sacres';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = CERCLES_SACRES_GAME.displayName;
  readonly description =
    'Formez trois Cercles Sacrés en alignant six cartes thématiques.';
  readonly minPlayers = CERCLES_SACRES_GAME.minPlayers;
  readonly maxPlayers = CERCLES_SACRES_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: CerclesSacresSetupService,
    private readonly actions: CerclesSacresActionService,
    private readonly presenter: CerclesSacresPresenterService,
    private readonly bots: CerclesSacresBotService,
  ) {
    super(registry);
  }
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    return this.setup.hydrateInitialState(baseState);
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    return this.actions.applyActions(state, actions);
  }

  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    return Rulebook.getAvailableActions(state, playerId);
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    return Rulebook.validateAction(state, action, actorId);
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return buildCerclesSacresShortcuts(ctx);
  }
}
