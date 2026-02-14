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
import { LesMainsActionService } from './actions/les-mains-de-la-terre-action.service';
import { LesMainsDeLaTerreBotService } from './bots/les-mains-de-la-terre-bot.service';
import { LesMainsPresenterService } from './presenter/les-mains-de-la-terre-presenter.service';
import { LesMainsSetupService } from './setup/les-mains-de-la-terre-setup.service';
import { LES_MAINS_GAME } from './definitions/game.definition';
import { buildLesMainsDeLaTerreShortcuts } from './les-mains-de-la-terre.shortcuts';

@Injectable()
export class LesMainsDeLaTerreService extends AbstractGameService {
  readonly gameType = LES_MAINS_GAME.id;
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'VentsDansants';
  readonly displayName = LES_MAINS_GAME.displayName;
  readonly description = 'Complétez des familles de métiers tout en jouant des cartes spéciales déboussolantes.';
  readonly minPlayers = LES_MAINS_GAME.minPlayers;
  readonly maxPlayers = LES_MAINS_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: LesMainsSetupService,
    private readonly actions: LesMainsActionService,
    private readonly presenter: LesMainsPresenterService,
    private readonly bots: LesMainsDeLaTerreBotService,
  ) {
    super(registry);
  }
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    return this.setup.hydrateInitialState(baseState);
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    return this.actions.applyActions(state, actions);
  }

  getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
    return Rulebook.getAvailableActions(state, playerId);
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    return Rulebook.validateAction(state, action, actorId);
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return buildLesMainsDeLaTerreShortcuts(ctx);
  }
}
