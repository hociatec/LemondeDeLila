import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../../core/entities/game-state.entity';
import {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../engine/dto/game-action.dto';
import { GameRegistryService } from '../../../../engine/services/game-registry.service';
import { AbstractGameService } from '../../../../engine/abstract/abstract-game.service';
import { BotProfile } from '../../../../modules/bot/services/bot-strategy.service';
import { LoupGarouActionService } from './actions/loup-garou-action.service';
import { LoupGarouBotService } from './bots/loup-garou-bot.service';
import { LoupGarouPhaseService } from './phases/loup-garou-phase.service';
import { LoupGarouPresenterService } from './presenter/loup-garou-presenter.service';
import { LoupGarouSetupService } from './setup/loup-garou-setup.service';
import { LOUP_GAROU_GAME } from './definitions/game.definition';
import { LOUP_GAROU_RULEBOOK } from './rulebook/rulebook';

const DEFAULT_BOT_PROFILE: BotProfile = 'greedy';

@Injectable()
export class LoupGarouService extends AbstractGameService {
  readonly gameType = 'loup-garou';
  readonly category = 'JeuxDeCartes';
  readonly subcategory = 'VillageMystique';
  readonly displayName = LOUP_GAROU_GAME.displayName;
  readonly description = 'Déduction sociale avec phases nuit/jour.';
  readonly minPlayers = LOUP_GAROU_GAME.minPlayers;
  readonly maxPlayers = LOUP_GAROU_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: LoupGarouSetupService,
    private readonly phases: LoupGarouPhaseService,
    private readonly actions: LoupGarouActionService,
    private readonly bots: LoupGarouBotService,
    private readonly presenter: LoupGarouPresenterService,
  ) {
    super(registry);
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    let state = this.setup.hydrateInitialState(baseState, {
      minPlayers: this.minPlayers,
      defaultBotProfile: DEFAULT_BOT_PROFILE,
    });

    if ((state.status || '').toLowerCase() === 'started') {
      state = this.phases.advanceState(state);
    }
    return state;
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = this.setup.ensureMetadata(state);
    if ((next.status || '').toLowerCase() !== 'started') {
      return next;
    }

    next = this.setup.ensureRolesInitialized(next, {
      minPlayers: this.minPlayers,
      defaultBotProfile: DEFAULT_BOT_PROFILE,
    });

    // Validation + application séquentielle : la validation dépend de l'état courant.
    for (const raw of Array.isArray(actions) ? actions : []) {
      const actorIdRaw = (raw?.meta as any)?.actorId;
      const actorId =
        typeof actorIdRaw === 'number'
          ? actorIdRaw
          : (next.turn?.currentPlayerId ?? null);
      const validated = LOUP_GAROU_RULEBOOK.validateAction(
        next,
        this.setup.metadataOf(next),
        raw,
        actorId,
      );
      next = this.actions.handleAction(next, validated);
    }
    next = this.phases.advanceState(next);

    const current = next.turn?.currentPlayerId ?? null;
    const isBot =
      (next.players ?? []).find((p) => p.id === current)?.isBot ?? false;
    return { ...next, botThinking: Boolean(isBot) };
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    return this.actions.getAvailableActions(state, playerId);
  }

  validateActor(
    state: GameStateEntity,
    _actions: GameSingleActionDto[],
    actorId: number | null,
  ): boolean {
    return this.actions.validateActor(state, actorId);
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    const meta = this.setup.metadataOf(state);
    return LOUP_GAROU_RULEBOOK.validateAction(state, meta, action, actorId);
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    return this.presenter.exposeState(state);
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }
}
