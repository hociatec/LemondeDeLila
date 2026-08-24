import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../models/game-action.model';
import { AbstractGameService } from '../../../../../application/services/abstract-game.service';
import { CorridorSetupService } from './corridor-setup.service';
import { CorridorActionService } from './corridor-action.service';
import { CorridorPresenterService } from './corridor-presenter.service';
import { CORRIDOR_GAME } from '../../definitions/game.definition';
import { CorridorBotService } from './corridor-bot.service';
import * as CorridorRulebook from '../../rulebook/rulebook';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../../../models/game-shortcuts.model';
import { interfaceShortcut } from '../../../../../application/helpers/shortcut-utils';
import type {
  CorridorMetadata,
  CorridorPos,
} from '../../model/corridor.model';
import type { CorridorWall } from '../../rulebook/rulebook';

type CorridorPending = {
  playerId?: number;
  data?: {
    pawns?: Array<{ id?: string; label?: string }>;
  };
};

export class CorridorService extends AbstractGameService {
  readonly gameType = 'corridor';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents SacrÃƒÆ’Ã‚Â©s';
  readonly displayName = CORRIDOR_GAME.displayName;
  readonly description =
    'DÃƒÆ’Ã‚Â©placez votre pion sur une grille (9ÃƒÆ’Ã¢â‚¬â€9) et atteignez le bord opposÃƒÆ’Ã‚Â©.';
  readonly minPlayers = CORRIDOR_GAME.minPlayers;
  readonly maxPlayers = CORRIDOR_GAME.maxPlayers;

  constructor(
    private readonly setup: CorridorSetupService,
    private readonly actions: CorridorActionService,
    private readonly presenter: CorridorPresenterService,
    private readonly bots: CorridorBotService,
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

  // Used by the engine to:
  // - expose `game.actions` when requested
  // - allow explicit "out of turn" actions (ex: pending choose_pawn while currentPlayerId is wrong/outdated).
  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    if (
      !state ||
      String(state.status ?? '')
        .trim()
        .toLowerCase() !== 'started'
    ) {
      return [];
    }

    const meta = (state.metadata ?? {}) as CorridorMetadata;
    if (String(meta.setupStep ?? '') === 'setup_config') {
      if (state.pending?.playerId !== playerId) {
        return [];
      }
      return [
        {
          type: 'corridor_set_config',
          payload: {},
          label: 'Configuration du Corridor',
        },
      ];
    }

    const pendingType = String(state.pending?.type ?? '')
      .trim()
      .toLowerCase();
    if (pendingType === 'choose_pawn') {
      if (state.pending?.playerId !== playerId) {
        return [];
      }

      const pending = (state.pending ?? null) as CorridorPending | null;
      const pawns = Array.isArray(pending?.data?.pawns)
        ? pending.data.pawns
        : [];

      return pawns
        .map((pawn) => {
          const id = String(pawn?.id ?? '').trim();
          if (!id) return null;
          return {
            type: 'choose_pawn',
            payload: { pawnId: id },
            label: String(pawn?.label ?? id).trim(),
          };
        })
        .filter((a): a is GameSingleActionDto => a != null);
    }

    // Any other pending state blocks gameplay actions for everyone.
    if (state.pending) {
      return [];
    }

    if (state.turn?.currentPlayerId !== playerId) {
      return [];
    }

    const moves =
      CorridorRulebook.listLegalPawnMoves(state, playerId) ?? [];
    const walls =
      CorridorRulebook.listLegalWallPlacements(state, playerId) ?? [];
    return [
      ...moves.map((to: CorridorPos) => ({
        type: 'corridor_move',
        payload: { x: to.x, y: to.y, _ui: { key: 'ENTER', kind: 'move' } },
      })),
      ...walls.map((w: CorridorWall) => ({
        type: 'corridor_place_wall',
        payload: {
          x: w.x,
          y: w.y,
          o: w.o,
          _ui: { key: 'M', kind: 'place_wall' },
        },
      })),
    ];
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

  getShortcuts(_ctx: GameShortcutsContext<unknown>): GameShortcutHint[] {
    return [
      interfaceShortcut('P', 'position'),
      interfaceShortcut('S', 'score'),
    ];
  }
}





