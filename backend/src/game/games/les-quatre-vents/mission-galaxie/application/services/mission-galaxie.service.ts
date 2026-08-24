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
import { MISSION_GALAXIE_GAME } from '../../definitions/mission-galaxie.definition';
import { MissionGalaxieSetupService } from './mission-galaxie-setup.service';
import { MissionGalaxieActionService } from './mission-galaxie-action.service';
import { MissionGalaxiePresenterService } from './mission-galaxie-presenter.service';
import { MissionGalaxieBotService } from './mission-galaxie-bot.service';
import * as Rulebook from '../../rulebook/rulebook';
import { buildMissionGalaxieShortcuts } from '../../shortcuts/mission-galaxie.shortcuts';

export class MissionGalaxieService extends AbstractGameService {
  readonly gameType = 'mission-galaxie';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = MISSION_GALAXIE_GAME.displayName;
  readonly description =
    'Course cosmique autour de 50 cases : questions, dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©fis et ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©nements vous propulsent vers la planÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨te lÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©gendaire.';
  readonly minPlayers = MISSION_GALAXIE_GAME.minPlayers;
  readonly maxPlayers = MISSION_GALAXIE_GAME.maxPlayers;

  constructor(
    private readonly setup: MissionGalaxieSetupService,
    private readonly actions: MissionGalaxieActionService,
    private readonly presenter: MissionGalaxiePresenterService,
    private readonly bots: MissionGalaxieBotService,
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

  getShortcuts(ctx: GameShortcutsContext<unknown>): GameShortcutHint[] {
    return buildMissionGalaxieShortcuts(ctx);
  }
}





