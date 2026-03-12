import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { CORRIDOR_GAME } from '../definitions/game.definition';
import { CORRIDOR_PAWNS } from '../definitions/corridor.pawns';
import type { CorridorMetadata } from '../model/corridor.model';
import { nextRngInt } from '../../../../../common/utils/seeded-rng';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';

@Injectable()
export class CorridorSetupService {
  constructor(private readonly setupFlow: SetupFlowService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const status = String(baseState.status ?? '')
      .toLowerCase()
      .trim();
    const currentStep = String(
      ((baseState.metadata ?? {}) as any)?.setupStep ?? '',
    ).trim();
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
        } as any,
      };
    }

    const players = baseState.players ?? [];
    if (players.length < CORRIDOR_GAME.minPlayers) {
      throw new Error(
        'Nombre de joueurs insuffisant pour demarrer Le Corridor.',
      );
    }

    const baseMeta =
      baseState.metadata && typeof baseState.metadata === 'object'
        ? (baseState.metadata as Record<string, unknown>)
        : {};
    const ownerPlayerId = this.resolveOwnerPlayerId(players as any[], baseMeta);
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
      } as any,
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
      } as any,
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
    const players = baseState.players ?? [];
    if (players.length < CORRIDOR_GAME.minPlayers) {
      throw new Error(
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
    const pawnByPlayerId: Record<string, string> = {};
    const usedPawnIds = new Set<string>();
    const log = [...(baseState.log ?? [])];

    for (const bot of players.filter((p) => p?.isBot === true)) {
      const pick = pawnChoices.find((pawn) => !usedPawnIds.has(pawn.id));
      if (!pick) break;
      pawnByPlayerId[String(bot.id)] = pick.id;
      usedPawnIds.add(pick.id);
      log.push({
        message: `${bot.username} choisit ${pick.label}.`,
        timestamp: new Date().toISOString(),
      });
    }

    const eligible = players.filter(
      (p) => p?.isBot !== true && !pawnByPlayerId[String(p?.id ?? '')],
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
      ...(metaAfterPick as any),
      size,
      setupStep: 'playing',
      ownerPlayerId: this.resolveOwnerPlayerId(players as any[], baseMeta),
      setupStarterId: p1.id,
      wallsPerPlayer,
      pawns: pawnChoices,
      pawnByPlayerId,
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

    const pendingChoices = pawnChoices
      .filter((pawn) => !usedPawnIds.has(pawn.id))
      .map((pawn) => ({
        id: pawn.id,
        label: `${pawn.label} - ${pawn.description}`,
        description: pawn.description,
      }));

    const pendingInfo =
      pendingPlayerId != null
        ? this.setupFlow.createSequentialPawnPending({
            players: players.map((player) => ({
              id: Number(player?.id),
              username:
                typeof player?.username === 'string' ? player.username : null,
            })),
            startPlayerId: pendingPlayerId,
            isAssigned: (playerId) => {
              const player = players.find((entry) => Number(entry?.id) === playerId);
              if (!player || player?.isBot === true) {
                return true;
              }
              return Boolean(pawnByPlayerId[String(playerId)]);
            },
            pendingType: 'choose_pawn',
            pawns: pendingChoices,
            pawnDataMapper: (choice) => ({
              id: String(choice.id ?? '').trim(),
              label: String(choice.label ?? '').trim(),
              description: String(choice.description ?? '').trim(),
            }),
          })
        : null;

    return {
      ...baseState,
      phase: 'play',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      metadata: metadata as any,
      pending: pendingInfo?.pending ?? null,
      log,
      turn: {
        currentPlayerId: pendingPlayerId ?? p1.id,
        direction: 1,
        label:
          pendingPlayerId != null ? 'Choix du pion' : `Tour de ${p1.username}`,
      },
    };
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
