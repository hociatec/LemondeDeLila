import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { LamaMetadata } from '../model/lama.model';
import { LamaRoundService } from '../round/lama-round.service';
import { LamaSharedService } from '../shared/lama-shared.service';
import { LamaLogService } from '../logging/lama-log.service';

@Injectable()
export class LamaSetupService {
  constructor(
    private readonly shared: LamaSharedService,
    private readonly round: LamaRoundService,
    private readonly logger: LamaLogService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const status = String(baseState.status ?? '').toLowerCase().trim();
    const currentStep = String(((baseState.metadata ?? {}) as any)?.step ?? '').trim();
    if (status === 'started' && currentStep && currentStep !== 'setup_config') {
      return baseState;
    }
    if (status !== 'started') {
      return {
        ...baseState,
        metadata: {
          ...(baseState.metadata ?? {}),
        } as any,
      };
    }

    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const metaAny = (baseState.metadata ?? {}) as any;

    const pickFirstHumanId = (): number | null => {
      const p = players.find((pl) => pl?.id && pl.isBot !== true);
      return typeof p?.id === 'number' ? p.id : null;
    };

    const pickOwnerId = (): number | null => {
      const metaOwner =
        typeof metaAny.ownerPlayerId === 'number' ? metaAny.ownerPlayerId : null;
      if (metaOwner != null && players.some((p) => p?.id === metaOwner)) {
        return metaOwner;
      }

      const roomOwner =
        typeof metaAny.roomOwnerId === 'number' ? metaAny.roomOwnerId : null;
      if (roomOwner != null && players.some((p) => p?.id === roomOwner)) {
        return roomOwner;
      }

      return pickFirstHumanId() ?? (players[0]?.id ?? null);
    };

    let ownerPlayerId = pickOwnerId();
    if (typeof ownerPlayerId === 'number') {
      const owner = players.find((p) => p?.id === ownerPlayerId) ?? null;
      if (owner?.isBot === true) {
        ownerPlayerId = pickFirstHumanId() ?? ownerPlayerId;
      }
    }
    const scoresByPlayerId: Record<string, number> = {};
    for (const p of players) {
      if (!p?.id) continue;
      scoresByPlayerId[String(p.id)] = 0;
    }

    const meta: LamaMetadata = {
      rng: typeof baseState.metadata === 'object' && baseState.metadata ? (baseState.metadata as any).rng : undefined,
      ownerPlayerId,
      loseAtScore: null,
      roundPauseSeconds: null,
      allowPlayAfterDraw: false,
      roundPauseUntilMs: null,
      roundNumber: 1,
      roundStarterIndex: 0,
      endedRoundNumber: null,
      deck: [],
      discard: [],
      handsByPlayerId: {},
      droppedOutByPlayerId: {},
      scoresByPlayerId,
      step: 'setup_config',
      turnTracker: { playerId: ownerPlayerId, drawn: false, played: false },
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
      winnerId: null,
      suppressTurnAnnouncement: true,
    };

    return {
      ...baseState,
      status: 'started',
      phase: 'setup',
      round: baseState.round ?? 0,
      turnIndex: baseState.turnIndex ?? 0,
      lastRoll: null,
      // Setup bloquant : l'acteur "pending" ne doit pas être écrasé par la randomisation du starter au démarrage.
      pending: { step: 'setup_config', playerId: ownerPlayerId, blocking: true } as any,
      log: Array.isArray(baseState.log) ? baseState.log : [],
      metadata: meta as any,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: ownerPlayerId,
        direction: 1,
        label: ownerPlayerId
          ? `Réglages LAMA : ${players.find((p) => p?.id === ownerPlayerId)?.username ?? `#${ownerPlayerId}`}`
          : 'Réglages LAMA',
      },
    };
  }

  applySetupConfig(
    state: GameStateEntity,
    meta: LamaMetadata,
    action: GameSingleActionDto,
    actorId: number,
  ): GameStateEntity {
    if (meta.ownerPlayerId == null || actorId !== meta.ownerPlayerId) return state;

    const rawLose = Number((action.payload as any)?.loseAtScore);
    const loseAtScore = Number.isFinite(rawLose) ? Math.floor(rawLose) : NaN;
    if (!Number.isFinite(loseAtScore) || loseAtScore < 5 || loseAtScore > 200) return state;

    const rawPause = Number((action.payload as any)?.roundPauseSeconds);
    const roundPauseSeconds = Number.isFinite(rawPause) ? Math.floor(rawPause) : NaN;
    if (!Number.isFinite(roundPauseSeconds) || roundPauseSeconds < 0 || roundPauseSeconds > 120) return state;

    const allowPlayAfterDraw = this.shared.asBoolean((action.payload as any)?.allowPlayAfterDraw);

    const updatedMeta: LamaMetadata = {
      ...meta,
      loseAtScore,
      roundPauseSeconds,
      allowPlayAfterDraw,
      roundPauseUntilMs: null,
      step: 'turn_choice',
      roundNumber: 1,
      roundStarterIndex: 0,
      turnTracker: { playerId: null, drawn: false, played: false },
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
      suppressTurnAnnouncement: true,
    };

    let log = state.log;
    const name = (state.players ?? []).find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
    log = this.logger.append(log, `${name} fixe la défaite à ${loseAtScore} jetons.`);
    log = this.logger.append(log, `${name} règle la pause entre manches à ${roundPauseSeconds}s.`);
    log = this.logger.append(
      log,
      allowPlayAfterDraw
        ? `${name} autorise à jouer après avoir pioché (même tour).`
        : `${name} interdit de jouer après avoir pioché (tour suivant).`,
    );
    log = this.logger.append(log, `Début de la partie.`);

    return this.round.startNewRound(
      {
        ...state,
        status: 'started',
        phase: 'round',
        round: 1,
        turnIndex: state.turnIndex ?? 0,
        lastRoll: null,
        pending: null,
        log,
        metadata: updatedMeta as any,
      },
      updatedMeta.roundStarterIndex,
    );
  }

  resumeRoundPause(state: GameStateEntity, meta: LamaMetadata): GameStateEntity {
    const until = typeof meta.roundPauseUntilMs === 'number' ? meta.roundPauseUntilMs : null;
    if (until != null && Date.now() < until) {
      return state;
    }
    const clearedMeta: LamaMetadata = {
      ...meta,
      roundPauseUntilMs: null,
      step: 'turn_choice',
      suppressTurnAnnouncement: false,
    };
    return this.round.startNewRound(
      {
        ...state,
        turnIndex: (state.turnIndex ?? 0) + 1,
        metadata: clearedMeta as any,
        phase: 'round',
        round: Number(clearedMeta.roundNumber ?? state.round ?? 1),
      },
      Number(clearedMeta.roundStarterIndex ?? 0),
    );
  }
}

