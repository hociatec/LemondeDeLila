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
import * as CorridorRulebook from './rulebook/rulebook';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../engine/shortcuts/game-shortcuts';
import { interfaceShortcut } from '../../../engine/shortcuts/shortcut-utils';

@Injectable()
export class CorridorService extends AbstractGameService {
  readonly gameType = 'corridor';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents Sacrés';
  readonly displayName = CORRIDOR_GAME.displayName;
  readonly description =
    'Déplacez votre pion sur une grille (9×9) et atteignez le bord opposé.';
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

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    return this.actions.applyActions(state, actions);
  }

  // Used by the engine to:
  // - expose `game.actions` when requested
  // - allow explicit "out of turn" actions (ex: pending choose_pawn while currentPlayerId is wrong/outdated).
  getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
    if (!state || String(state.status ?? '').trim().toLowerCase() !== 'started') {
      return [];
    }

    const meta = (state.metadata ?? {}) as any;
    if (String(meta.setupStep ?? '') === 'setup_config') {
      if (state.pending?.playerId !== playerId) {
        return [];
      }
      return [
        {
          type: 'corridor_set_config',
          payload: {},
          label: 'Configuration du Corridor',
        } as any,
      ];
    }

    const pendingType = String(state.pending?.type ?? '').trim().toLowerCase();
    if (pendingType === 'choose_pawn') {
      if (state.pending?.playerId !== playerId) {
        return [];
      }

      const pawns = Array.isArray((state.pending?.data as any)?.pawns)
        ? ((state.pending?.data as any).pawns as Array<any>)
        : [];

      return pawns
        .map((pawn) => {
          const id = String(pawn?.id ?? '').trim();
          if (!id) return null;
          return {
            type: 'choose_pawn',
            payload: { pawnId: id },
            label: String(pawn?.label ?? id).trim(),
          } as any;
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

    const moves = CorridorRulebook.listLegalPawnMoves(state as any, playerId) ?? [];
    const walls = CorridorRulebook.listLegalWallPlacements(state as any, playerId) ?? [];
    return [
      ...moves.map((to: any) => ({
        type: 'corridor_move',
        payload: { x: to.x, y: to.y, _ui: { key: 'ENTER', kind: 'move' } },
      })),
      ...walls.map((w: any) => ({
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

  getShortcuts(_ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    return [
      interfaceShortcut('P', 'position'),
      interfaceShortcut('S', 'score'),
    ];
  }
}
