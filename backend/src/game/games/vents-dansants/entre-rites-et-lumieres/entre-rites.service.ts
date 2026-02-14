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
import { EntreRitesActionService } from './actions/entre-rites-action.service';
import { EntreRitesPresenterService } from './presenter/entre-rites-presenter.service';
import { EntreRitesSetupService } from './setup/entre-rites-setup.service';
import { EntreRitesBotService } from './bots/entre-rites-bot.service';
import { ENTRE_RITES_GAME } from './definitions/game.definition';
import { buildEntreRitesShortcuts } from './entre-rites.shortcuts';

@Injectable()
export class EntreRitesService extends AbstractGameService {
  readonly gameType = 'entre-rites-et-lumieres';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = ENTRE_RITES_GAME.displayName;
  readonly description =
    'Un sept familles illuminé où familles et cartes spéciales s’affrontent.';
  readonly minPlayers = ENTRE_RITES_GAME.minPlayers;
  readonly maxPlayers = ENTRE_RITES_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: EntreRitesSetupService,
    private readonly actions: EntreRitesActionService,
    private readonly presenter: EntreRitesPresenterService,
    private readonly bots: EntreRitesBotService,
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
    return buildEntreRitesShortcuts(ctx);
  }
}
