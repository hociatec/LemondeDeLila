import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../application/models/game-action.model';
import { AbstractGameService } from '../../../../../application/services/abstract-game.service';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../application/models/game-shortcuts.model';
import * as FouleesFantastiquesRulebook from '../../rulebook/rulebook';
import { FouleesFantastiquesActionService } from './foulees-fantastiques-action.service';
import { FouleesFantastiquesPhaseService } from './foulees-fantastiques-phase.service';
import { FouleesFantastiquesPresenterService } from './foulees-fantastiques-presenter.service';
import { FouleesFantastiquesSetupService } from './foulees-fantastiques-setup.service';
import { FOULEES_FANTASTIQUES_GAME } from '../../definitions/game.definition';
import { FouleesFantastiquesBotService } from './foulees-fantastiques-bot.service';
import { buildFouleesFantastiquesShortcuts } from '../../foulees-fantastiques.shortcuts';

export class FouleesFantastiquesService extends AbstractGameService {
  readonly gameType = 'foulees-fantastiques';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents Sacrés';
  readonly displayName = FOULEES_FANTASTIQUES_GAME.displayName;
  readonly description = 'le jeu classique des petits chevaux';
  readonly minPlayers = FOULEES_FANTASTIQUES_GAME.minPlayers;
  readonly maxPlayers = FOULEES_FANTASTIQUES_GAME.maxPlayers;

  constructor(
    private readonly setup: FouleesFantastiquesSetupService,
    private readonly actions: FouleesFantastiquesActionService,
    private readonly phases: FouleesFantastiquesPhaseService,
    private readonly presenter: FouleesFantastiquesPresenterService,
    private readonly bots: FouleesFantastiquesBotService,
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
    return FouleesFantastiquesRulebook.getAvailableActions(state, playerId);
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    return FouleesFantastiquesRulebook.validateAction(state, action, actorId);
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    // Fallback (non personnalisé) : aucune action.
    return { ...state, actions: [] };
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getShortcuts(ctx: GameShortcutsContext<unknown>): GameShortcutHint[] {
    return buildFouleesFantastiquesShortcuts(ctx);
  }
}





