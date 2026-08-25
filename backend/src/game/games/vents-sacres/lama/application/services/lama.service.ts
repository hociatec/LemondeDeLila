import { AbstractGameService } from '../../../../../core/application/services/abstract-game.service';
import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../core/application/models/game-action.model';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../shortcuts/public-api';
import type { GameAutomaticActionPlan } from '../../../../../core/application/models/game-automation.model';
import type { LamaMetadata } from '../../model/lama.model';
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

  getAutomaticActions(state: GameStateEntity): GameAutomaticActionPlan | null {
    const metadata = (state.metadata ?? {}) as Partial<LamaMetadata>;
    if (metadata.step !== 'round_pause') return null;
    const roundNumber = Number(metadata.roundNumber ?? state.round ?? 0);
    const executeAtMs = Number(metadata.roundPauseUntilMs ?? Date.now());
    return {
      key: `round-pause:${roundNumber}`,
      executeAtMs: Number.isFinite(executeAtMs) ? executeAtMs : Date.now(),
      actions: [{ type: 'lama_resume_round', payload: {} }],
    };
  }
}
