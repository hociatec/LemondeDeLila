import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../application/models/game-action.model';
import { optionalInt } from '../../../../../application/helpers/payload-validators.helper';
import type { LamaMetadata } from '../../model/lama.model';
import { LamaLogService } from './lama-log.service';
import { LamaRoundService } from './lama-round.service';
import { LamaSharedService } from './lama-shared.service';

export class LamaSetupConfigService {
  constructor(
    private readonly shared: LamaSharedService,
    private readonly round: LamaRoundService,
    private readonly logger: LamaLogService,
  ) {}

  apply(
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
      const name = this.shared.playerLabel(players, actorId);
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
    const name = this.shared.playerLabel(players, actorId);
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
        metadata: updatedMeta,
      },
      updatedMeta.roundStarterIndex,
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

}
