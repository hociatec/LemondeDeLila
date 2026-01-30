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
import { SAC_A_MALICES_GAME } from '../sac-a-malices/definitions/sac-a-malices.definition';
import { SacAMalicesActionService } from '../sac-a-malices/actions/sac-a-malices-action.service';
import { SacAMalicesPresenterService } from '../sac-a-malices/presenter/sac-a-malices-presenter.service';
import { SacAMalicesBotService } from '../sac-a-malices/bots/sac-a-malices-bot.service';
import * as Rulebook from '../sac-a-malices/rulebook/rulebook';
import { buildSacAMalicesShortcuts } from '../sac-a-malices/sac-a-malices.shortcuts';
import { SacAMalicesVioletteBoussoleSetupService } from './setup/sac-a-malices-violette-boussole-setup.service';

@Injectable()
export class SacAMalicesVioletteBoussoleService
  implements GameRulesAdapter, OnModuleInit
{
  readonly gameType = 'sac-a-malices-violette-boussole';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = 'Sac à Malices — Violette & Boussole';
  readonly description = 'Variante Toulouse (Violette & Boussole).';
  readonly minPlayers = SAC_A_MALICES_GAME.minPlayers;
  readonly maxPlayers = SAC_A_MALICES_GAME.maxPlayers;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly setup: SacAMalicesVioletteBoussoleSetupService,
    private readonly actions: SacAMalicesActionService,
    private readonly presenter: SacAMalicesPresenterService,
    private readonly bots: SacAMalicesBotService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
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

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return buildSacAMalicesShortcuts(ctx);
  }
}

