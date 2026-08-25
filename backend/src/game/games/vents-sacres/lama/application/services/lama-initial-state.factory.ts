import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { getSafePlayers } from '../../../../../core/application/helpers/setup-service.helper';
import { createPendingState } from '../../../../../core/application/services/pending-action.service';
import type { LamaMetadata } from '../../model/lama.model';
import { LamaSharedService } from './lama-shared.service';

export class LamaInitialStateFactory {
  constructor(private readonly shared: LamaSharedService) {}

  build(baseState: GameStateEntity): GameStateEntity {
    const baseMeta =
      baseState.metadata && typeof baseState.metadata === 'object'
        ? (baseState.metadata as Record<string, unknown>)
        : {};
    const status = String(baseState.status ?? '')
      .toLowerCase()
      .trim();
    const currentStep =
      typeof baseMeta.step === 'string' ? baseMeta.step.trim() : '';
    const phase = String(baseState.phase ?? '')
      .toLowerCase()
      .trim();
    if (status === 'started' && phase === 'round') {
      return baseState;
    }
    if (status === 'started' && currentStep && currentStep !== 'setup_config') {
      return baseState;
    }
    if (status !== 'started') {
      return {
        ...baseState,
        metadata: {
          ...baseMeta,
        },
      };
    }

    const players = getSafePlayers(baseState);

    const pickFirstHumanId = (): number | null => {
      const p = players.find((pl) => pl?.id && pl.isBot !== true);
      return typeof p?.id === 'number' ? p.id : null;
    };

    const pickOwnerId = (): number | null => {
      const metaOwner =
        typeof baseMeta.ownerPlayerId === 'number'
          ? baseMeta.ownerPlayerId
          : null;
      if (metaOwner != null && players.some((p) => p?.id === metaOwner)) {
        return metaOwner;
      }

      const roomOwner =
        typeof baseMeta.roomOwnerId === 'number' ? baseMeta.roomOwnerId : null;
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
        baseMeta.rng && typeof baseMeta.rng === 'object'
          ? (baseMeta.rng as Record<string, unknown>)
          : {},
      ownerPlayerId,
      loseAtScore: null,
      roundPauseSeconds: null,
      allowPlayAfterDraw: false,
      startingHandSize: null,
      copiesPerCardValue: null,
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
        metadata: meta,
        turn: {
          ...(baseState.turn ?? { direction: 1 }),
          currentPlayerId: ownerPlayerId,
          direction: 1,
          label: ownerPlayerId
            ? `Réglages LAMA : ${this.shared.playerLabel(players, ownerPlayerId)}`
            : 'Réglages LAMA',
        },
      },
      {
        step: 'setup_config',
        playerId: ownerPlayerId,
        blocking: true,
      },
    );
  }
}
