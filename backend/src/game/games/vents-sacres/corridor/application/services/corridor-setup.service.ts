import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { GameConfigurationError } from '../../../../../domain/errors/game-domain.errors';
import { CORRIDOR_GAME } from '../../definitions/game.definition';
import { CORRIDOR_PAWNS } from '../../definitions/corridor.pawns';
import type { CorridorMetadata } from '../../model/corridor.model';
import { nextRngInt } from '../../../../../../common/utils/seeded-rng';
import { SetupFlowService } from '../../../../../application/services/setup-flow.service';
import { GameCoreService } from '../../../../../application/services/game-core.service';
import {
  assignConfiguredBotPawns,
  queueConfiguredPawnSelection,
} from '../../../../../application/helpers/configured-pawn-setup.helper';

type CorridorPlayer = {
  id: number;
  username?: string;
  isBot?: boolean;
};

type CorridorConfigPromptPending = {
  type: 'config_prompt';
  playerId: number | null;
  blocking: true;
  label: string;
  choices: [];
  data: {
    title: string;
    actionType: 'corridor_set_config';
    fields: Array<{
      key: 'wallsPerPlayer';
      label: string;
      kind: 'number';
      min: number;
      max: number;
      initialText: string;
    }>;
  };
};

export class CorridorSetupService {
  constructor(
    private readonly setupFlow: SetupFlowService,
    private readonly core: GameCoreService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const status = String(baseState.status ?? '')
      .toLowerCase()
      .trim();
    const baseMetadata = (baseState.metadata ?? {}) as Partial<CorridorMetadata>;
    const currentStep = String(baseMetadata.setupStep ?? '').trim();
    if (status === 'started' && currentStep && currentStep !== 'setup_config') {
      return baseState;
    }
    if (status !== 'started') {
      return {
        ...baseState,
        metadata: {
          ...(baseState.metadata ?? {}),
          size: CORRIDOR_GAME.boardSize,
          wallsPerPlayer: CORRIDOR_GAME.wallsPerPlayer,
          winnerPlayerId: null,
        },
      };
    }

    const players = (baseState.players ?? []) as CorridorPlayer[];
    if (players.length < CORRIDOR_GAME.minPlayers) {
      throw new GameConfigurationError(
        'Nombre de joueurs insuffisant pour demarrer Le Corridor.',
      );
    }

    const baseMeta =
      baseState.metadata && typeof baseState.metadata === 'object'
        ? (baseState.metadata as Record<string, unknown>)
        : {};
    const ownerPlayerId = this.resolveOwnerPlayerId(players, baseMeta);
    const wallsPerPlayer = this.resolveWallsPerPlayer(baseMeta.wallsPerPlayer);

    return {
      ...baseState,
      phase: 'setup',
      metadata: {
        ...baseMeta,
        size: CORRIDOR_GAME.boardSize,
        setupStep: 'setup_config',
        ownerPlayerId,
        wallsPerPlayer,
        winnerPlayerId: null,
        winnerId: null,
      },
      pending: {
        type: 'config_prompt',
        playerId: ownerPlayerId,
        blocking: true,
        label: 'Configuration Corridor.',
        choices: [],
        data: {
          title: 'Le Corridor',
          actionType: 'corridor_set_config',
          fields: [
            {
              key: 'wallsPerPlayer',
              label: 'Nombre de murs par joueur',
              kind: 'number',
              min: 0,
              max: 20,
              initialText: String(wallsPerPlayer),
            },
          ],
        },
      } as CorridorConfigPromptPending,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: ownerPlayerId,
        direction: 1,
        label: 'Réglages Corridor',
      },
    };
  }

  applySetupConfig(
    baseState: GameStateEntity,
    wallsPerPlayer: number,
  ): GameStateEntity {
    const players = (baseState.players ?? []) as CorridorPlayer[];
    if (players.length < CORRIDOR_GAME.minPlayers) {
      throw new GameConfigurationError(
        'Nombre de joueurs insuffisant pour demarrer Le Corridor.',
      );
    }

    const size = CORRIDOR_GAME.boardSize;
    const p1 = players[0];
    const p2 = players[1];
    const startX = Math.floor(size / 2);
    const pawnChoices = CORRIDOR_PAWNS.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
    }));
    const baseMeta =
      baseState.metadata && typeof baseState.metadata === 'object'
        ? (baseState.metadata as Record<string, unknown>)
        : {};
    const withBots = assignConfiguredBotPawns({
      state: {
        ...baseState,
        metadata: {
          ...baseMeta,
          pawns: pawnChoices,
        },
      },
      core: this.core,
      catalog: pawnChoices,
      metadataAssignmentKey: 'pawnByPlayerId',
      isBotPlayer: (player) => player?.isBot === true,
      logLabelResolver: (choice) => String(choice.label ?? choice.id).trim(),
    });
    const assignedPawns =
      ((withBots.metadata as CorridorMetadata | undefined)?.pawnByPlayerId ??
        {}) as Record<string, string>;

    const eligible = players.filter(
      (p) => p?.isBot !== true && !assignedPawns[String(p?.id ?? '')],
    );
    const pick =
      eligible.length > 1 ? nextRngInt(baseMeta, eligible.length) : null;
    const pendingPlayerId =
      eligible.length <= 0
        ? null
        : eligible.length === 1
          ? (eligible[0].id ?? null)
          : (eligible[pick!.value]?.id ?? eligible[0].id ?? null);
    const metaAfterPick = pick?.meta ?? baseMeta;

    const metadata: CorridorMetadata = {
      ...(metaAfterPick as Record<string, unknown>),
      size,
      setupStep: 'playing',
      ownerPlayerId: this.resolveOwnerPlayerId(players, baseMeta),
      setupStarterId: p1.id,
      wallsPerPlayer,
      pawns: pawnChoices,
      pawnByPlayerId: assignedPawns,
      pawnsByPlayerId: {
        [String(p1.id)]: { x: startX, y: 0 },
        [String(p2.id)]: { x: startX, y: size - 1 },
      },
      goalYByPlayerId: {
        [String(p1.id)]: size - 1,
        [String(p2.id)]: 0,
      },
      walls: { h: [], v: [] },
      wallsRemainingByPlayerId: {
        [String(p1.id)]: wallsPerPlayer,
        [String(p2.id)]: wallsPerPlayer,
      },
      winnerPlayerId: null,
      winnerId: null,
    };

    const initialized: GameStateEntity = {
      ...withBots,
      phase: 'play',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      metadata,
      pending: null,
      turn: {
        currentPlayerId: pendingPlayerId ?? p1.id,
        direction: 1,
        label:
          pendingPlayerId != null ? 'Choix du pion' : `Tour de ${p1.username}`,
      },
    };

    return queueConfiguredPawnSelection({
      state: initialized,
      core: this.core,
      setupFlow: this.setupFlow,
      catalog: pawnChoices,
      startPlayerId: pendingPlayerId,
      pendingType: 'choose_pawn',
      metadataAssignmentKey: 'pawnByPlayerId',
      isBotPlayer: (player) => player?.isBot === true,
      pawnDataMapper: (choice) => ({
        id: String(choice.id ?? '').trim(),
        label: `${String(choice.label ?? '').trim()} - ${String(choice.description ?? '').trim()}`,
        description: String(choice.description ?? '').trim(),
      }),
    });
  }

  private resolveOwnerPlayerId(
    players: Array<{ id: number; isBot?: boolean }>,
    metadata: Record<string, unknown>,
  ): number | null {
    const pickFirstHuman = (): number | null => {
      const human = players.find((p) => p?.id != null && p.isBot !== true);
      return typeof human?.id === 'number' ? human.id : null;
    };
    const ownerRaw =
      typeof metadata?.ownerPlayerId === 'number'
        ? metadata.ownerPlayerId
        : typeof metadata?.roomOwnerId === 'number'
          ? metadata.roomOwnerId
          : null;
    if (
      typeof ownerRaw === 'number' &&
      players.some((p) => Number(p?.id) === ownerRaw && p?.isBot !== true)
    ) {
      return ownerRaw;
    }
    return pickFirstHuman() ?? players[0]?.id ?? null;
  }

  resolveWallsPerPlayer(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return CORRIDOR_GAME.wallsPerPlayer;
    const rounded = Math.round(parsed);
    if (rounded < 0 || rounded > 20) return CORRIDOR_GAME.wallsPerPlayer;
    return rounded;
  }
}



