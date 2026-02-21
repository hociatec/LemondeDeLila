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
import { PIRATES_GAME } from './definitions/pirates-en-vadrouille.definition';
import { PiratesEnVadrouilleSetupService } from './setup/pirates-en-vadrouille-setup.service';
import { PiratesEnVadrouilleActionService } from './actions/pirates-en-vadrouille-action.service';
import { PiratesEnVadrouillePresenterService } from './presenter/pirates-en-vadrouille-presenter.service';
import { PiratesEnVadrouilleBotService } from './bots/pirates-en-vadrouille-bot.service';
import * as Rulebook from './rulebook/rulebook';
import { buildPiratesEnVadrouilleShortcuts } from './shortcuts/pirates-en-vadrouille.shortcuts';

@Injectable()
export class PiratesEnVadrouilleService extends AbstractGameService {
  readonly gameType = 'pirates-en-vadrouille';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = PIRATES_GAME.displayName;
  readonly description =
    'Parcourez l’île Papayousse, piochez bonus ou obstacles et récoltez trésors et pièces d’or.';
  readonly minPlayers = PIRATES_GAME.minPlayers;
  readonly maxPlayers = PIRATES_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: PiratesEnVadrouilleSetupService,
    private readonly actions: PiratesEnVadrouilleActionService,
    private readonly presenter: PiratesEnVadrouillePresenterService,
    private readonly bots: PiratesEnVadrouilleBotService,
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

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return buildPiratesEnVadrouilleShortcuts(ctx);
  }
}
