import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { AbstractGameService } from '../../../engine/abstract/abstract-game.service';
import { CorridorSetupService } from './setup/corridor-setup.service';
import { CorridorActionService } from './actions/corridor-action.service';
import { CorridorPresenterService } from './presenter/corridor-presenter.service';
import { CORRIDOR_GAME } from './definitions/game.definition';
import { CorridorBotService } from './bots/corridor-bot.service';

@Injectable()
export class CorridorService extends AbstractGameService {
  readonly gameType = 'corridor';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents Sacrés';
  readonly displayName = CORRIDOR_GAME.displayName;
  readonly description = 'Déplacez votre pion sur une grille (9×9) et atteignez le bord opposé.';
  readonly minPlayers = CORRIDOR_GAME.minPlayers;
  readonly maxPlayers = CORRIDOR_GAME.maxPlayers;

  constructor(
    registry: GameRegistryService,
    private readonly setup: CorridorSetupService,
    private readonly actions: CorridorActionService,
    private readonly presenter: CorridorPresenterService,
    private readonly bots: CorridorBotService,
  ) {
    super(registry);
    this.registry = registry;
  }

  registry: GameRegistryService;
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    return this.setup.hydrateInitialState(baseState);
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    return this.actions.applyActions(state, actions);
  }

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    return this.bots.getBotActions(state, botPlayerId);
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }
}
