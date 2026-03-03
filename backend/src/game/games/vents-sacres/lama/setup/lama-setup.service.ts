import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';

import { getSafePlayers } from '../../../../setup/setup-service.helper';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { createPendingState } from '../../../../modules/pending-action/services/pending-action.service';
import { optionalInt } from '../../../../core/helpers/payload-validators.helper';
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
    const status = String(baseState.status ?? '')
      .toLowerCase()
      .trim();
    const currentStep = String(
      ((baseState.metadata ?? {}) as any)?.step ?? '',
    ).trim();
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

    const players = getSafePlayers(baseState);
    const metaAny = (baseState.metadata ?? {}) as any;

    const pickFirstHumanId = (): number | null => {
      const p = players.find((pl) => pl?.id && pl.isBot !== true);
      return typeof p?.id === 'number' ? p.id : null;
    };

    const pickOwnerId = (): number | null => {
      const metaOwner =
        typeof metaAny.ownerPlayerId === 'number'
          ? metaAny.ownerPlayerId
          : null;
      if (metaOwner != null && players.some((p) => p?.id === metaOwner)) {
        return metaOwner;
      }

      const roomOwner =
        typeof metaAny.roomOwnerId === 'number' ? metaAny.roomOwnerId : null;
      if (roomOwner != null && players.some((p) => p?.id === roomOwner)) {
        return roomOwner;
      }

      return pickFirstHumanId() ?? players[0]?.id ?? null;
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
      rng:
        typeof baseState.metadata === 'object' && baseState.metadata
          ? (baseState.metadata as any).rng
          : undefined,
      ownerPlayerId,
      loseAtScore: null,
      roundPauseSeconds: null,
      allowPlayAfterDraw: false,
      startingHandSize: null,
      copiesPerCardValue: null,
      allowDrawAfterFirstQuit: false,
      returnTokenFromRound: null,
      roundPauseUntilMs: null,
      roundNumber: 1,
      roundStarterIndex: 0,
      endedRoundNumber: null,
      deck: [],
      discard: [],
      handsByPlayerId: {},
      droppedOutByPlayerId: {},
      scoresByPlayerId,
      eliminatedByPlayerId: {},
      step: 'setup_config',
      turnTracker: { playerId: ownerPlayerId, drawn: false, played: false },
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
      winnerId: null,
      suppressTurnAnnouncement: true,
    };

    return createPendingState(
      {
        ...baseState,
        status: 'started',
        phase: 'setup',
        round: baseState.round ?? 0,
        turnIndex: baseState.turnIndex ?? 0,
        lastRoll: null,
        log: Array.isArray(baseState.log) ? baseState.log : [],
        metadata: meta as any,
        turn: {
          ...(baseState.turn ?? { direction: 1 }),
          currentPlayerId: ownerPlayerId,
          direction: 1,
          label: ownerPlayerId
            ? `Réglages LAMA : ${this.shared.playerLabel(players as any[], ownerPlayerId)}`
            : 'Réglages LAMA',
        },
      } as GameStateEntity,
      {
        step: 'setup_config',
        playerId: ownerPlayerId,
        blocking: true,
      } as any,
    );
  }

  applySetupConfig(
    state: GameStateEntity,
    meta: LamaMetadata,
    action: GameSingleActionDto,
    actorId: number,
  ): GameStateEntity {
    if (meta.ownerPlayerId == null || actorId !== meta.ownerPlayerId)
      return state;

    const loseAtScore = (() => {
      try {
        return optionalInt(action.payload ?? {}, 'loseAtScore');
      } catch {
        return undefined;
      }
    })();
    if (
      !Number.isFinite(loseAtScore) ||
      loseAtScore == null ||
      loseAtScore < 5 ||
      loseAtScore > 200
    ) {
      return state;
    }

    const roundPauseSeconds = (() => {
      try {
        return optionalInt(action.payload ?? {}, 'roundPauseSeconds');
      } catch {
        return Number.NaN;
      }
    })();
    if (Number.isNaN(roundPauseSeconds)) return state;
    if (
      !Number.isFinite(roundPauseSeconds) ||
      roundPauseSeconds == null ||
      roundPauseSeconds < 0 ||
      roundPauseSeconds > 120
    ) {
      return state;
    }

    const startingHandSizeRaw = (() => {
      try {
        return optionalInt(action.payload ?? {}, 'startingHandSize');
      } catch {
        return undefined;
      }
    })();
    const startingHandSize = Number(
      startingHandSizeRaw ?? meta.startingHandSize ?? 6,
    );
    if (
      !Number.isFinite(startingHandSize) ||
      startingHandSize < 1 ||
      startingHandSize > 20
    ) {
      return state;
    }

    const copiesPerCardValueRaw = (() => {
      try {
        return optionalInt(action.payload ?? {}, 'copiesPerCardValue');
      } catch {
        return undefined;
      }
    })();
    const copiesPerCardValue = Number(
      copiesPerCardValueRaw ?? meta.copiesPerCardValue ?? 8,
    );
    if (
      !Number.isFinite(copiesPerCardValue) ||
      copiesPerCardValue < 1 ||
      copiesPerCardValue > 20
    ) {
      return state;
    }

    const returnTokenFromRoundRaw = (() => {
      try {
        return optionalInt(action.payload ?? {}, 'returnTokenFromRound');
      } catch {
        return undefined;
      }
    })();
    const returnTokenFromRound = Number(
      returnTokenFromRoundRaw ?? meta.returnTokenFromRound ?? 2,
    );
    if (
      !Number.isFinite(returnTokenFromRound) ||
      returnTokenFromRound < 1 ||
      returnTokenFromRound > 50
    ) {
      return state;
    }

    const players = Array.isArray(state.players) ? state.players : [];
    const activePlayers = players.filter((p) => p?.id).length;
    const deckSize = 7 * copiesPerCardValue;
    if (activePlayers * startingHandSize + 1 > deckSize) {
      const maxHandSize =
        activePlayers > 0 ? Math.floor((deckSize - 1) / activePlayers) : 0;
      const name = this.shared.playerLabel(players as any[], actorId);
      const nextLog = this.logger.append(
        state.log,
        `${name} propose une configuration invalide: ${startingHandSize} cartes de départ avec ${activePlayers} joueurs et ${copiesPerCardValue} exemplaires par carte. Maximum autorisé: ${Math.max(maxHandSize, 1)} cartes.`,
      );
      return {
        ...state,
        log: nextLog,
      };
    }

    const updatedMeta: LamaMetadata = {
      ...meta,
      loseAtScore,
      roundPauseSeconds,
      allowPlayAfterDraw: this.readAllowPlayAfterDraw(action.payload ?? {}),
      startingHandSize,
      copiesPerCardValue,
      allowDrawAfterFirstQuit: this.readAllowDrawAfterFirstQuit(
        action.payload ?? {},
        meta.allowDrawAfterFirstQuit ?? false,
      ),
      returnTokenFromRound,
      roundPauseUntilMs: null,
      step: 'turn_choice',
      roundNumber: 1,
      roundStarterIndex: 0,
      turnTracker: { playerId: null, drawn: false, played: false },
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
      eliminatedByPlayerId: {},
      suppressTurnAnnouncement: true,
    };

    let log = state.log;
    const name = this.shared.playerLabel(players as any[], actorId);
    log = this.logger.append(
      log,
      `${name} fixe la défaite à ${loseAtScore} jetons.`,
    );
    log = this.logger.append(
      log,
      `${name} règle la pause entre manches à ${roundPauseSeconds}s.`,
    );
    log = this.logger.append(
      log,
      `${name} ${updatedMeta.allowPlayAfterDraw ? 'autorise' : 'interdit'} de rejouer après une pioche.`,
    );
    log = this.logger.append(
      log,
      `${name} distribue ${startingHandSize} cartes par manche.`,
    );
    log = this.logger.append(
      log,
      `${name} règle le paquet à ${copiesPerCardValue} exemplaires par valeur.`,
    );
    log = this.logger.append(
      log,
      `${name} ${updatedMeta.allowDrawAfterFirstQuit ? 'autorise' : 'interdit'} la pioche après le premier retrait.`,
    );
    log = this.logger.append(
      log,
      `${name} autorise le rendu de jetons à partir de la manche ${returnTokenFromRound}.`,
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

  resumeRoundPause(
    state: GameStateEntity,
    meta: LamaMetadata,
  ): GameStateEntity {
    const until =
      typeof meta.roundPauseUntilMs === 'number'
        ? meta.roundPauseUntilMs
        : null;
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

  private readAllowPlayAfterDraw(payload: Record<string, unknown>): boolean {
    const raw = payload?.allowPlayAfterDraw;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw === 1;
    if (typeof raw !== 'string') return false;
    const value = raw.trim().toLowerCase();
    if (
      value === 'true' ||
      value === '1' ||
      value === 'yes' ||
      value === 'oui' ||
      value === 'on'
    ) {
      return true;
    }
    if (
      value === 'false' ||
      value === '0' ||
      value === 'no' ||
      value === 'non' ||
      value === 'off'
    ) {
      return false;
    }
    return false;
  }

  private readAllowDrawAfterFirstQuit(
    payload: Record<string, unknown>,
    fallback: boolean,
  ): boolean {
    const raw = payload?.allowDrawAfterFirstQuit;
    if (raw == null || raw === '') return fallback;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw === 1;
    if (typeof raw !== 'string') return fallback;
    const value = raw.trim().toLowerCase();
    if (
      value === 'true' ||
      value === '1' ||
      value === 'yes' ||
      value === 'oui' ||
      value === 'on'
    ) {
      return true;
    }
    if (
      value === 'false' ||
      value === '0' ||
      value === 'no' ||
      value === 'non' ||
      value === 'off'
    ) {
      return false;
    }
    return fallback;
  }
}
