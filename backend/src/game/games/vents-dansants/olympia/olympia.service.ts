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
import { OlympiaActionService } from './actions/olympia-action.service';
import { OlympiaPresenterService } from './presenter/olympia-presenter.service';
import { OlympiaSetupService } from './setup/olympia-setup.service';
import { OlympiaBotService } from './bots/olympia-bot.service';
import { OLYMPIA_GAME } from './definitions/game.definition';
import { buildOlympiaShortcuts } from './olympia.shortcuts';

@Injectable()
export class OlympiaService extends AbstractGameService {
  readonly gameType = 'olympia';
  readonly category = 'JeuxDeCartes';
  readonly subcategory = 'VentsDansants';
  readonly displayName = OLYMPIA_GAME.displayName;
  readonly description =
    'Accumulez un maximum de prestige divin en jouant vos héros, exploits, créatures, actions, attaques et événements.';
  readonly minPlayers = OLYMPIA_GAME.minPlayers;
  readonly maxPlayers = OLYMPIA_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: OlympiaSetupService,
    private readonly actions: OlympiaActionService,
    private readonly presenter: OlympiaPresenterService,
    private readonly bots: OlympiaBotService,
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
    return buildOlympiaShortcuts(ctx);
  }
}
