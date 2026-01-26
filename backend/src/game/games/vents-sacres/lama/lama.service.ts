import { Injectable } from '@nestjs/common';
import { AbstractGameService } from '../../../engine/abstract/abstract-game.service';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import type { GameShortcutHint, GameShortcutsContext } from '../../../engine/shortcuts/game-shortcuts';
import { LamaPresenter } from './lama.presenter';
import { LamaActionService } from './actions/lama-action.service';
import { LamaSetupService } from './setup/lama-setup.service';
import { LamaBotService } from './bots/lama-bot.service';
import { LamaShortcutsService } from './shortcuts/lama-shortcuts.service';

@Injectable()
export class LamaService extends AbstractGameService {
  readonly gameType = 'lama';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents Sacrés';
  readonly displayName = 'LAMA';
  readonly description = 'Défaussez vos cartes ou sortez de la manche pour minimiser vos jetons.';
  readonly minPlayers = 2;
  readonly maxPlayers = 6;

  constructor(
    registry: GameRegistryService,
    private readonly presenter: LamaPresenter,
    private readonly actions: LamaActionService,
    private readonly setup: LamaSetupService,
    private readonly bots: LamaBotService,
    private readonly shortcuts: LamaShortcutsService,
  ) {
    super(registry);
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    return this.setup.hydrateInitialState(baseState);
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    return this.actions.applyActions(state, actions);
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return this.shortcuts.getShortcuts(ctx);
  }
}
