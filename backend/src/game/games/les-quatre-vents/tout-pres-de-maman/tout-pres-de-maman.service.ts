import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../engine/shortcuts/game-shortcuts';
import { TOUT_PRES_DE_MAMAN_GAME } from './definitions/tout-pres-de-maman.definition';
import { ToutPresDeMamanActionService } from './actions/tout-pres-de-maman-action.service';
import { ToutPresDeMamanPresenterService } from './presenter/tout-pres-de-maman-presenter.service';
import { ToutPresDeMamanSetupService } from './setup/tout-pres-de-maman-setup.service';
import { ToutPresDeMamanBotService } from './bots/tout-pres-de-maman-bot.service';
import * as Rulebook from './rulebook/rulebook';
import { buildToutPresDeMamanShortcuts } from './shortcuts/tout-pres-de-maman.shortcuts';

@Injectable()
export class ToutPresDeMamanService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = TOUT_PRES_DE_MAMAN_GAME.id;
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = TOUT_PRES_DE_MAMAN_GAME.displayName;
  readonly description =
    'Guide votre bébé marsupial jusqu’à maman avec au moins trois jetons eucalyptus.';
  readonly minPlayers = TOUT_PRES_DE_MAMAN_GAME.minPlayers;
  readonly maxPlayers = TOUT_PRES_DE_MAMAN_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: ToutPresDeMamanSetupService,
    private readonly actions: ToutPresDeMamanActionService,
    private readonly presenter: ToutPresDeMamanPresenterService,
    private readonly bots: ToutPresDeMamanBotService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
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
    return buildToutPresDeMamanShortcuts(ctx);
  }
}
