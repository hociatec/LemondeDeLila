import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../models/game-action.model';
import { AbstractGameService } from '../../../../../application/services/abstract-game.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../models/game-shortcuts.model';
import * as JeuOieRulebook from '../../rulebook/rulebook';
import { JeuOieActionService } from './jeu-oie-action.service';
import { JeuOiePhaseService } from './jeu-oie-phase.service';
import { JeuOiePresenterService } from './jeu-oie-presenter.service';
import { JeuOieSetupService } from './jeu-oie-setup.service';
import { JEU_OIE_GAME } from '../../definitions/game.definition';
import { JeuOieBotService } from './jeu-oie-bot.service';
import { buildJeuOieShortcuts } from '../../jeu-oie.shortcuts';

export class JeuOieService extends AbstractGameService {
  readonly gameType = 'jeu-oie';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents SacrÃƒÆ’Ã‚Â©s';
  readonly displayName = JEU_OIE_GAME.displayName;
  readonly description = "Le jeu de l'oie (course sur 63 cases).";
  readonly minPlayers = JEU_OIE_GAME.minPlayers;
  readonly maxPlayers = JEU_OIE_GAME.maxPlayers;

  constructor(
    private readonly setup: JeuOieSetupService,
    private readonly actions: JeuOieActionService,
    private readonly phases: JeuOiePhaseService,
    private readonly presenter: JeuOiePresenterService,
    private readonly bots: JeuOieBotService,
  ) {
    super();
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

  getShortcuts(ctx: GameShortcutsContext<unknown>): GameShortcutHint[] {
    return buildJeuOieShortcuts(ctx);
  }
}






