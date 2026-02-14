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
import * as JeuOieRulebook from './rulebook/rulebook';
import { JeuOieActionService } from './actions/jeu-oie-action.service';
import { JeuOiePhaseService } from './phases/jeu-oie-phase.service';
import { JeuOiePresenterService } from './presenter/jeu-oie-presenter.service';
import { JeuOieSetupService } from './setup/jeu-oie-setup.service';
import { JEU_OIE_GAME } from './definitions/game.definition';
import { JeuOieBotService } from './bots/jeu-oie-bot.service';
import { buildJeuOieShortcuts } from './jeu-oie.shortcuts';

@Injectable()
export class JeuOieService extends AbstractGameService {
  readonly gameType = 'jeu-oie';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents Sacrés';
  readonly displayName = JEU_OIE_GAME.displayName;
  readonly description = "Le jeu de l'oie (course sur 63 cases).";
  readonly minPlayers = JEU_OIE_GAME.minPlayers;
  readonly maxPlayers = JEU_OIE_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: JeuOieSetupService,
    private readonly actions: JeuOieActionService,
    private readonly phases: JeuOiePhaseService,
    private readonly presenter: JeuOiePresenterService,
    private readonly bots: JeuOieBotService,
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
    const next = this.actions.applyActions(state, actions);
    return this.phases.advance(next);
  }

  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    return JeuOieRulebook.getAvailableActions(state, playerId);
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    return JeuOieRulebook.validateAction(state, action, actorId);
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
    return buildJeuOieShortcuts(ctx);
  }
}
