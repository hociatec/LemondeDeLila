import { AbstractGameService } from '../../../../../application/services/abstract-game.service';
import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../application/models/game-action.model';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../application/models/game-shortcuts.model';
import { LamaPresenter } from './lama.presenter';
import { LamaActionService } from './lama-action.service';
import { LamaSetupService } from './lama-setup.service';
import { LamaBotService } from './lama-bot.service';
import { LamaShortcutsService } from './lama-shortcuts.service';

export class LamaService extends AbstractGameService {
  readonly gameType = 'lama';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents Sacrés';
  readonly displayName = 'LAMA';
  readonly description =
    'Défaussez vos cartes ou sortez de la manche pour minimiser vos jetons.';
  readonly minPlayers = 2;
  readonly maxPlayers = 6;

  constructor(
    private readonly presenter: LamaPresenter,
    private readonly actions: LamaActionService,
    private readonly setup: LamaSetupService,
    private readonly bots: LamaBotService,
    private readonly shortcuts: LamaShortcutsService,
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

  getShortcuts(ctx: GameShortcutsContext<unknown>): GameShortcutHint[] {
    return this.shortcuts.getShortcuts(ctx);
  }
}






