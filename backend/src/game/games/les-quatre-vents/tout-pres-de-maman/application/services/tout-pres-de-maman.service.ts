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
import { TOUT_PRES_DE_MAMAN_GAME } from '../../definitions/tout-pres-de-maman.definition';
import { ToutPresDeMamanActionService } from './tout-pres-de-maman-action.service';
import { ToutPresDeMamanPresenterService } from './tout-pres-de-maman-presenter.service';
import { ToutPresDeMamanSetupService } from './tout-pres-de-maman-setup.service';
import { ToutPresDeMamanBotService } from './tout-pres-de-maman-bot.service';
import * as Rulebook from '../../rulebook/rulebook';
import { buildToutPresDeMamanShortcuts } from '../../shortcuts/tout-pres-de-maman.shortcuts';

export class ToutPresDeMamanService extends AbstractGameService {
  readonly gameType = TOUT_PRES_DE_MAMAN_GAME.id;
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'LesQuatreVents';
  readonly displayName = TOUT_PRES_DE_MAMAN_GAME.displayName;
  readonly description =
    'Guide votre bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©bÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© marsupial jusquÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  maman avec au moins trois jetons eucalyptus.';
  readonly minPlayers = TOUT_PRES_DE_MAMAN_GAME.minPlayers;
  readonly maxPlayers = TOUT_PRES_DE_MAMAN_GAME.maxPlayers;

  constructor(
    private readonly setup: ToutPresDeMamanSetupService,
    private readonly actions: ToutPresDeMamanActionService,
    private readonly presenter: ToutPresDeMamanPresenterService,
    private readonly bots: ToutPresDeMamanBotService,
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
    return buildToutPresDeMamanShortcuts(ctx);
  }
}





