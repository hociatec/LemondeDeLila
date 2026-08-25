import type {
  GameStateEntity,
  PendingState,
} from '../../../../../core/application/models/game-state.model';
import type { LamaCardValue, LamaMetadata } from '../../model/lama.model';
import { lamaCardLabel } from '../../model/lama.model';
import { RandomService } from '../../../../../core/application/services/random.service';
import { createPendingState } from '../../../../../core/application/services/pending-action.service';
import { LamaLogService } from './lama-log.service';
import { LamaRoundRules } from './lama-round.rules';
import { LamaSharedService } from './lama-shared.service';

export class LamaRoundDealer {
  constructor(
    private readonly random: RandomService,
    private readonly logger: LamaLogService,
    private readonly shared: LamaSharedService,
    private readonly rules: LamaRoundRules,
  ) {}

  start(state: GameStateEntity, starterIndex: number): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    const scores = meta.scoresByPlayerId ?? {};
    const loseAt = Number(meta.loseAtScore ?? 40);
    const eliminatedByPlayerId = this.rules.buildEliminatedByScore(
      players,
      scores,
      loseAt,
      meta.eliminatedByPlayerId ?? {},
    );
    const roundPlayers = players.filter(
      (p) => p?.id && !eliminatedByPlayerId[String(p.id)],
    );
    if (roundPlayers.length === 0) {
      return state;
    }

    const startingHandSize = this.rules.resolveStartingHandSize(
      meta.startingHandSize,
    );
    const copiesPerCardValue = this.rules.resolveCopiesPerCardValue(
      meta.copiesPerCardValue,
    );
    const baseDeck = this.rules.buildDeck(copiesPerCardValue);
    const rngMeta =
      typeof meta.rng === 'object' && meta.rng ? { ...meta.rng } : {};
    const shuffled = this.random.shuffle(rngMeta, baseDeck);
    meta.rng = shuffled.meta;
    const deck = shuffled.values;

    const handsByPlayerId: Record<string, LamaCardValue[]> = {};
    const droppedOutByPlayerId: Record<string, boolean> = {};
    for (const p of players) {
      if (!p?.id) continue;
      if (!eliminatedByPlayerId[String(p.id)]) {
        handsByPlayerId[String(p.id)] = [];
      }
      droppedOutByPlayerId[String(p.id)] = Boolean(
        eliminatedByPlayerId[String(p.id)],
      );
    }

    for (let i = 0; i < startingHandSize; i += 1) {
      for (const p of roundPlayers) {
        if (!p?.id) continue;
        const card = deck.pop();
        if (!card) continue;
        handsByPlayerId[String(p.id)].push(card);
      }
    }

    const firstDiscard = deck.pop() ?? 1;
    const discard: LamaCardValue[] = [firstDiscard];

    const normalizedStarterIndex = this.rules.findNextSurvivorStarterIndex(
      players,
      eliminatedByPlayerId,
      Math.max(-1, starterIndex - 1),
    );
    const starterPlayerId =
      players[normalizedStarterIndex]?.id ?? roundPlayers[0]?.id ?? null;
    const starterName =
      starterPlayerId != null
        ? this.shared.playerLabel(players, starterPlayerId)
        : null;
    let log = this.logger.append(
      state.log,
      `Début de la manche ${meta.roundNumber}.`,
    );
    if (starterName) {
      log = this.logger.append(log, `C'est au tour de ${starterName}.`);
    }
    log = this.logger.append(log, `Défausse: ${lamaCardLabel(firstDiscard)}.`);
    const nextMeta: LamaMetadata & { winnerPlayerId?: number | null } = {
      ...meta,
      roundStarterIndex: normalizedStarterIndex,
      deck,
      discard,
      handsByPlayerId,
      droppedOutByPlayerId,
      eliminatedByPlayerId,
      step: 'turn_choice',
      turnTracker: { playerId: starterPlayerId, drawn: false, played: false },
      endedRoundNumber: null,
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
      winnerId: null,
      winnerPlayerId: null,
      suppressTurnAnnouncement: false,
    };

    const nextPending: PendingState = {
      step: 'turn_choice',
      playerId: starterPlayerId,
    };
    return createPendingState(
      {
        ...state,
        metadata: nextMeta,
        log,
        turn: {
          ...(state.turn ?? { direction: 1 }),
          currentPlayerId: starterPlayerId,
          direction: 1,
          label: starterPlayerId
            ? `Tour de ${this.shared.playerLabel(players, starterPlayerId)}`
            : undefined,
        },
      },
      nextPending,
    );
  }
}
