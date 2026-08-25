import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../../core/application/helpers/action-service.helper';
import { resolvePlayerNameFromState } from '../../../../../core/application/helpers/player-name.helper';

import type { GameSingleActionDto } from '../../../../../core/application/models/game-action.model';

import { GameCoreService } from '../../../../../core/application/services/game-core.service';
import { RandomService } from '../../../../../core/application/services/random.service';
import { TurnFlowService } from '../../../../../core/application/services/turn-flow.service';
import { DeckPoliciesService } from '../../../../../deck-policies/application/services/deck-policies.service';
import type {
  MonVillageCard,
  MonVillageMetadata,
  MonVillageCollection,
} from '../../model/mon-village-state.model';
import {
  asMonVillagePartialMeta,
  describeMonVillagePawnLabel,
  getMonVillageZoneForTile,
  ZONE_MAP,
} from './mon-village-action.utils';

export class MonVillageActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
    private readonly deckPolicies: DeckPoliciesService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const next = applyActionsSequentially(state, actions, (next, action) => {
      const type = normalizeActionType(action);
      return dispatchByActionType(
        type,
        {
          roll: () => {
            next = this.handleRoll(next);
            return next;
          },
        },
        () => next,
      );
    });
    return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    if (state.pending) return state;

    const playerId = state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const meta = this.getMeta(state);
    const skip = meta.statuses?.skipTurn?.[playerId] ?? 0;
    if (skip > 0) {
      const nextStatuses = {
        ...meta.statuses,
        skipTurn: {
          ...(meta.statuses.skipTurn ?? {}),
          [playerId]: Math.max(0, skip - 1),
        },
      };
      return this.turns.advanceTurn(
        this.core.appendLog(
          {
            ...state,
            metadata: {
              ...(state.metadata ?? {}),
              ...meta,
              statuses: nextStatuses,
            },
          },
          `${resolvePlayerNameFromState(state, playerId)} saute son tour (${skip} restant).`,
        ),
      );
    }

    const rng = this.random.rollDice(meta as Record<string, unknown>, 6);
    const nextMeta: MonVillageMetadata = {
      ...meta,
      ...asMonVillagePartialMeta(rng.meta),
    };
    let next: GameStateEntity = {
      ...state,
      lastRoll: rng.roll,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} lance le dé : "${rng.roll}".`,
    );

    next = this.move(next, playerId, rng.roll);
    next = this.applyLanding(next, playerId);

    const updatedMeta = this.getMeta(next);
    if (updatedMeta.winnerId != null) return { ...next, status: 'finished' };
    if (next.pending) return next;

    return this.turns.advanceTurn(next);
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);
    const pos = meta.positions?.[playerId] ?? 0;
    const tile = meta.tiles[pos];
    if (!tile) return next;

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} place ${describeMonVillagePawnLabel(next, playerId)} en case ${tile.n} (${tile.title}).`,
    );

    if (tile.type === 'finish') {
      return this.finishGame(next, playerId);
    }

    return this.collectCard(next, playerId, tile.n);
  }

  private collectCard(
    state: GameStateEntity,
    playerId: number,
    tileNumber: number,
  ): GameStateEntity {
    const zoneId = getMonVillageZoneForTile(tileNumber);
    if (zoneId == null) return state;

    const meta = this.getMeta(state);
    const drawn = this.drawCard(meta, zoneId);
    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...drawn.meta },
    };
    const card = drawn.card;
    if (!card) {
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} n’a plus de cartes dans la zone ${zoneId}.`,
      );
    }

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} collecte "${card.title}".`,
    );
    next = this.updateCollections(next, playerId, card);
    return next;
  }

  private updateCollections(
    state: GameStateEntity,
    playerId: number,
    card: MonVillageCard,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const collections = { ...(meta.collections ?? {}) };
    const existing = collections[playerId] ?? { total: 0, byZone: {} };
    const zoneCount = (existing.byZone ?? {})[card.zoneId] ?? 0;
    const updated: MonVillageCollection = {
      total: existing.total + 1,
      byZone: { ...(existing.byZone ?? {}), [card.zoneId]: zoneCount + 1 },
    };
    collections[playerId] = updated;
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, collections },
    };
  }

  private finishGame(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const entries = Object.entries(meta.collections ?? {}).map(
      ([id, value]) => ({
        id: Number(id),
        ...value,
      }),
    );
    let best = entries
      .filter((entry) => Number.isFinite(entry.id))
      .sort((a, b) => b.total - a.total)[0];
    if (!best) best = { id: playerId, total: 0, byZone: {} };
    const tied = entries.filter((entry) => entry.total === best.total);
    if (tied.length > 1) {
      for (const zone of ZONE_MAP.map((range) => range.id)) {
        const zoneBest = tied
          .map((entry) => ({
            id: entry.id,
            count: entry.byZone?.[zone] ?? 0,
          }))
          .sort((a, b) => b.count - a.count)[0];
        if (zoneBest && zoneBest.count > 0) {
          best = tied.find((entry) => entry.id === zoneBest.id) ?? best;
          if (
            tied.some(
              (entry) =>
                entry.id !== best.id &&
                (entry.byZone?.[zone] ?? 0) === zoneBest.count,
            )
          ) {
            continue;
          }
          break;
        }
      }
    }

    const nextMeta: MonVillageMetadata = {
      ...meta,
      winnerId: best.id,
    };
    let next: GameStateEntity = {
      ...state,
      status: 'finished',
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, best.id)} remporte la partie avec ${best.total} cartes !`,
    );
    return next;
  }

  private move(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.positions?.[playerId] ?? 0;
    const nextPos = Math.max(
      0,
      Math.min(current + delta, (meta.tiles?.length ?? 1) - 1),
    );
    return this.setPos(state, playerId, nextPos);
  }

  private setPos(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const updated: MonVillageMetadata = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: pos },
    };
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...updated },
    };
  }

  private drawCard(
    meta: MonVillageMetadata,
    zoneId: number,
  ): { card: MonVillageCard | null; meta: MonVillageMetadata } {
    const draw = this.deckPolicies.drawFromPile<
      MonVillageCard,
      MonVillageMetadata
    >({
      meta,
      pile: Array.isArray(meta.decks?.[zoneId]) ? meta.decks[zoneId] : [],
      discard: Array.isArray(meta.discards?.[zoneId])
        ? meta.discards[zoneId]
        : [],
      useWholeMetaRng: true,
      discardDrawnCard: true,
    });
    const nextMeta: MonVillageMetadata = {
      ...draw.meta,
      decks: { ...draw.meta.decks, [zoneId]: draw.pile },
      discards: {
        ...draw.meta.discards,
        [zoneId]: draw.discard,
      },
    };
    return { card: draw.card, meta: nextMeta };
  }

  private getMeta(state: GameStateEntity): MonVillageMetadata {
    return (state.metadata ?? {}) as MonVillageMetadata;
  }

  private pawnLabel(state: GameStateEntity, id: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const player = players.find((p) => p?.id === id) ?? null;
    const pawn =
      typeof player?.pawn === 'string' ? String(player.pawn).trim() : '';
    if (!pawn) return '"son pion"';
    const lower = pawn.toLowerCase();
    const feminine = lower.startsWith('la ') || lower.startsWith('une ');
    const inner = pawn
      .replace(/^l['’]\s*/i, '')
      .replace(/^(le|la|les|un|une)\s+/i, '')
      .trim();
    const core = inner || pawn;
    const lowered =
      core.length <= 1
        ? core.toLowerCase()
        : `${core.charAt(0).toLowerCase()}${core.slice(1)}`;
    return `"${feminine ? 'sa' : 'son'} ${lowered}"`;
  }
}
