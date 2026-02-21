import { Injectable } from '@nestjs/common';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../core/entities/game-state.entity';
import {
  applyActionsSequentially,
  dispatchByActionType,
  harmonizeActionStateReturn,
  normalizeActionType,
} from '../../../../actions/action-service.helper';
import { resolvePlayerNameFromState } from '../../../../modules/turn-policies/player-name.helper';

import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';

import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import {
  createPendingState,
  isPendingType,
} from '../../../../modules/pending-action/services/pending-action.service';
import type {
  MissionGalaxieChoiceCard,
  MissionGalaxieDeckName,
  MissionGalaxieEventCard,
  MissionGalaxieMetadata,
  MissionGalaxiePendingContext,
} from '../model/mission-galaxie-state.entity';

type MissionGalaxieMetadataWithFlags = MissionGalaxieMetadata & {
  keepTurn?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function asPartialMeta(
  value: unknown,
): Partial<MissionGalaxieMetadataWithFlags> {
  return value != null && typeof value === 'object'
    ? (value as Partial<MissionGalaxieMetadataWithFlags>)
    : {};
}

function readEventMoveOptions(
  pending: unknown,
): Array<{ targetPlayerId: number; delta: number }> {
  const row = asRecord(pending);
  const data = asRecord(row.data);
  const options = Array.isArray(data.options) ? data.options : [];
  return options
    .map((entry) => {
      const option = asRecord(entry);
      return {
        targetPlayerId: Number(option.targetPlayerId),
        delta: Number(option.delta),
      };
    })
    .filter(
      (entry) =>
        Number.isFinite(entry.targetPlayerId) && Number.isFinite(entry.delta),
    );
}

@Injectable()
export class MissionGalaxieActionService {
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
    return applyActionsSequentially(
      harmonizeActionStateReturn(state),
      actions,
      (next, action) => {
        const current = harmonizeActionStateReturn(next);
        const type = normalizeActionType(action);
        return dispatchByActionType(
          type,
          {
            roll: () => this.handleRoll(current),
            draw: () => this.handleDraw(current),
            choose_option: () => this.handleChooseOption(current, action),
            choose_event_move: () =>
              this.handleChooseEventMove(current, action),
          },
          () => current,
        );
      },
    );
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    if (state.pending) return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    let meta = this.getMeta(state);
    const skipTurns = meta.statuses?.skipTurn?.[currentId] ?? 0;
    if (skipTurns > 0) {
      const nextStatuses = {
        ...meta.statuses,
        skipTurn: {
          ...(meta.statuses.skipTurn ?? {}),
          [currentId]: Math.max(0, skipTurns - 1),
        },
      };
      meta = { ...meta, statuses: nextStatuses };
      const skipped = this.core.appendLog(
        { ...state, metadata: { ...(state.metadata ?? {}), ...meta } },
        `${resolvePlayerNameFromState(state, currentId)} passe son tour (${skipTurns} restant).`,
      );
      return this.turns.advanceTurn(skipped);
    }

    const rng = this.random.rollDice(meta as Record<string, unknown>, 6);
    meta = { ...meta, ...asPartialMeta(rng.meta) };
    const roll = rng.roll;

    let next: GameStateEntity = {
      ...state,
      lastRoll: roll,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} lance le dé : "${roll}".`,
    );

    next = this.move(next, currentId, roll);
    next = this.applyLanding(next, currentId);

    const updatedMeta = this.getMeta(next);
    if (updatedMeta.winnerId != null) return { ...next, status: 'finished' };
    if (next.pending) return next;

    const keepTurn =
      (updatedMeta as MissionGalaxieMetadataWithFlags).keepTurn === true;
    if (keepTurn) {
      const nextMeta = { ...updatedMeta };
      delete (nextMeta as MissionGalaxieMetadataWithFlags).keepTurn;
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), ...nextMeta },
      };
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId)} rejoue.`,
      );
    }

    return this.turns.advanceTurn(next);
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const pending = state.pending;
    if (!isPendingType(state, 'draw')) return state;
    const pendingRow = asRecord(pending);

    const playerId =
      typeof pendingRow.playerId === 'number'
        ? pendingRow.playerId
        : (state.turn?.currentPlayerId ?? null);
    if (playerId == null) return state;

    const pendingData = asRecord(pendingRow.data);
    const deckName =
      typeof pendingData.deck === 'string'
        ? (pendingData.deck as MissionGalaxieDeckName)
        : undefined;
    if (!deckName) return state;

    const meta = this.getMeta(state);
    const draw = this.drawCard(meta, deckName);
    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: { ...(state.metadata ?? {}), ...draw.meta },
    };
    const card = draw.card;
    if (!card) {
      return this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} n'a plus de cartes ${deckName}.`,
      );
    }

    if (deckName === 'events') {
      return this.applyEventCard(
        next,
        playerId,
        card as MissionGalaxieEventCard,
      );
    }

    const cardKind = deckName === 'questions' ? 'question' : 'challenge';
    const ctx: MissionGalaxiePendingContext = {
      kind: cardKind,
      actorId: playerId,
      card: card as MissionGalaxieChoiceCard,
    };

    const pendingState: PendingState = {
      type: 'choose_option',
      playerId,
      blocking: true,
      label:
        cardKind === 'question'
          ? 'Répondez à la question galactique.'
          : 'Résolvez le défi cosmique.',
      choices: (card as MissionGalaxieChoiceCard).choices,
      data: { choices: (card as MissionGalaxieChoiceCard).choices },
    };

    const withContext = this.getMeta(next);
    const updatedMeta: MissionGalaxieMetadataWithFlags = {
      ...withContext,
      pendingContext: ctx,
    };
    next = createPendingState(next, pendingState);
    next = {
      ...next,
      metadata: { ...(next.metadata ?? {}), ...updatedMeta },
    };
    return this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} pioche la carte "${card.title}".`,
    );
  }

  private handleChooseOption(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    if (!isPendingType(state, 'choose_option')) return state;

    const payload = asRecord(action.payload);
    const choiceIndex = Number(payload.choiceIndex);
    if (!Number.isFinite(choiceIndex)) return state;

    const meta = this.getMeta(state);
    const ctx = meta.pendingContext;
    if (
      !ctx ||
      (ctx.kind !== 'question' && ctx.kind !== 'challenge') ||
      ctx.actorId !== currentId
    ) {
      return { ...state, pending: null };
    }

    const card = ctx.card;
    const isCorrect = choiceIndex === card.correctIndex;
    const delta = isCorrect ? card.correctDelta : card.wrongDelta;
    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        pendingContext: null,
      },
    };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} répond à "${card.title}" : ${
        isCorrect ? 'Correct' : 'Erreur'
      } (${delta >= 0 ? 'avance' : 'recule'} ${Math.abs(delta)}).`,
    );
    next = this.move(next, currentId, delta);
    next = this.applyLanding(next, currentId);
    return next;
  }

  private handleChooseEventMove(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const pending = state.pending;
    if (!isPendingType(state, 'choose_event_move')) return state;

    const payload = asRecord(action.payload);
    const targetPlayerId = Number(payload.targetPlayerId);
    const delta = Number(payload.delta);
    if (!Number.isFinite(targetPlayerId) || !Number.isFinite(delta))
      return state;

    const meta = this.getMeta(state);
    const ctx = meta.pendingContext;
    if (!ctx || ctx.kind !== 'choosePlayerMove' || ctx.actorId !== currentId) {
      return { ...state, pending: null };
    }

    const options = readEventMoveOptions(pending);
    const isValid = options.some(
      (opt) => opt.targetPlayerId === targetPlayerId && opt.delta === delta,
    );
    if (!isValid) return state;

    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: { ...(state.metadata ?? {}), ...meta, pendingContext: null },
    };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} applique ${
        delta >= 0 ? 'un boost' : 'une perturbation'
      } à ${resolvePlayerNameFromState(next, targetPlayerId)} (${delta >= 0 ? '+' : ''}${delta}).`,
    );
    next = this.move(next, targetPlayerId, delta);
    next = this.applyLanding(next, targetPlayerId);
    return next;
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const pos = meta.positions?.[playerId] ?? 0;
    const tile = meta.tiles[pos];
    if (!tile) return next;

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} place ${this.pawnLabel(next, playerId)} en case ${tile.n} (${tile.title}).`,
    );

    switch (tile.type) {
      case 'move':
        if (typeof tile.delta === 'number' && tile.delta !== 0) {
          next = this.core.appendLog(
            next,
            `${resolvePlayerNameFromState(next, playerId)} suit l'effet du plateau (${tile.delta >= 0 ? 'avance' : 'recule'} ${Math.abs(
              tile.delta,
            )}).`,
          );
          next = this.move(next, playerId, tile.delta);
          return this.applyLanding(next, playerId);
        }
        break;
      case 'skip': {
        meta = this.getMeta(next);
        const currentSkip = meta.statuses?.skipTurn?.[playerId] ?? 0;
        const addition =
          typeof tile.skipTurns === 'number' ? tile.skipTurns : 1;
        meta = {
          ...meta,
          statuses: {
            ...meta.statuses,
            skipTurn: {
              ...(meta.statuses.skipTurn ?? {}),
              [playerId]: currentSkip + addition,
            },
          },
        };
        next = {
          ...next,
          metadata: { ...(next.metadata ?? {}), ...meta },
        };
        return this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} doit sauter ${addition} tour(s).`,
        );
      }
      case 'question':
        next = this.core.appendLog(next, 'Piochez une question galactique.');
        return this.promptDraw(next, playerId, 'questions');
      case 'challenge':
        next = this.core.appendLog(next, 'Piochez un défi cosmique.');
        return this.promptDraw(next, playerId, 'challenges');
      case 'event':
        next = this.core.appendLog(next, 'Piochez un événement spatial.');
        return this.promptDraw(next, playerId, 'events');
      case 'swapNearest':
        return this.applySwapNearest(next, playerId);
      case 'goto':
        if (typeof tile.target === 'number') {
          const targetIndex = Math.max(
            0,
            Math.min(tile.target - 1, meta.tiles.length - 1),
          );
          if (targetIndex !== pos) {
            next = this.setPos(next, playerId, targetIndex);
            return this.applyLanding(next, playerId);
          }
        }
        break;
      case 'finish':
        return this.finishGame(next, playerId);
      default:
    }

    if (tile.keepTurn) {
      meta = this.getMeta(next);
      const updatedMeta: MissionGalaxieMetadataWithFlags = {
        ...meta,
        keepTurn: true,
      };
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), ...updatedMeta },
      };
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} reçoit un tour bonus.`,
      );
    }

    return next;
  }

  private promptDraw(
    state: GameStateEntity,
    playerId: number,
    deck: MissionGalaxieDeckName,
  ): GameStateEntity {
    const pending: PendingState = {
      type: 'draw',
      playerId,
      blocking: true,
      label:
        deck === 'events'
          ? 'Piochez un événement spatial.'
          : deck === 'questions'
            ? 'Piochez une question galactique.'
            : 'Piochez un défi cosmique.',
      data: { deck },
    };
    return createPendingState(state, pending);
  }

  private applySwapNearest(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const pos = meta.positions?.[playerId] ?? 0;
    const entries = Object.entries(meta.positions ?? {})
      .map(([key, value]) => ({ id: Number(key), pos: value ?? 0 }))
      .filter((entry) => Number.isFinite(entry.id) && entry.id !== playerId);
    if (!entries.length) return next;
    const closest = entries.reduce(
      (best, current) => {
        const diff = Math.abs(current.pos - pos);
        return best === null || diff < Math.abs(best.pos - pos)
          ? current
          : best;
      },
      null as { id: number; pos: number } | null,
    );
    if (!closest) return next;

    const nextPositions = {
      ...(meta.positions ?? {}),
      [playerId]: closest.pos,
      [closest.id]: pos,
    };
    meta = { ...meta, positions: nextPositions };
    next = {
      ...next,
      metadata: { ...(next.metadata ?? {}), ...meta },
    };
    return this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} échangée sa position avec ${resolvePlayerNameFromState(next, closest.id)}.`,
    );
  }

  private applyEventCard(
    state: GameStateEntity,
    playerId: number,
    card: MissionGalaxieEventCard,
  ): GameStateEntity {
    let next = this.core.appendLog(
      state,
      `${resolvePlayerNameFromState(state, playerId)} déclenche l'événement "${card.title}".`,
    );
    const effect = card.effect;
    switch (effect.kind) {
      case 'move':
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} avance de ${effect.delta} cases.`,
        );
        next = this.move(next, playerId, effect.delta);
        return this.applyLanding(next, playerId);
      case 'skip':
        next = this.addSkip(next, playerId, effect.turns);
        return this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} doit sauter ${effect.turns} tour(s).`,
        );
      case 'none':
        return next;
      case 'reroll':
        next = this.setKeepTurn(next);
        return this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} relance immédiatement le dé.`,
        );
      case 'keepTurn':
        next = this.setKeepTurn(next);
        return this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} rejoue immédiatement.`,
        );
      case 'goto':
        next = this.setPos(
          next,
          playerId,
          Math.max(
            0,
            Math.min(effect.target - 1, this.getMeta(next).tiles.length - 1),
          ),
        );
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} avance jusqu'à la case ${effect.target}.`,
        );
        return this.applyLanding(next, playerId);
      case 'skipOthers':
        next = this.skipOthers(next, playerId, effect.turns);
        return this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} force les autres à sauter ${effect.turns} tour(s).`,
        );
      case 'choosePlayerMove':
        return this.promptPlayerMove(next, playerId, effect.deltas);
      default:
        return next;
    }
  }

  private promptPlayerMove(
    state: GameStateEntity,
    playerId: number,
    deltas: number[],
  ): GameStateEntity {
    let next = state;
    const players = Array.isArray(state.players) ? state.players : [];
    const options: Array<{
      targetPlayerId: number;
      delta: number;
      label: string;
    }> = [];
    const targetPlayers = players.filter((p) => p?.id != null);
    for (const delta of deltas) {
      for (const player of targetPlayers) {
        const targetId = player.id;
        options.push({
          targetPlayerId: targetId,
          delta,
          label: `${resolvePlayerNameFromState(next, targetId)} ${delta >= 0 ? `avance de ${delta}` : `recule de ${Math.abs(delta)}`}`,
        });
      }
    }

    const pending: PendingState = {
      type: 'choose_event_move',
      playerId,
      blocking: true,
      label: 'Choisissez un joueur et un mouvement.',
      data: { options },
    };
    const nextMeta: MissionGalaxieMetadataWithFlags = {
      ...this.getMeta(next),
      pendingContext: {
        kind: 'choosePlayerMove',
        actorId: playerId,
        deltas,
      },
    };
    next = createPendingState(next, pending);
    next = {
      ...next,
      metadata: { ...(next.metadata ?? {}), ...nextMeta },
    };
    return next;
  }

  private addSkip(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const currentSkip = meta.statuses?.skipTurn?.[playerId] ?? 0;
    const nextMeta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        skipTurn: {
          ...(meta.statuses.skipTurn ?? {}),
          [playerId]: currentSkip + turns,
        },
      },
    };
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
  }

  private setKeepTurn(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: MissionGalaxieMetadataWithFlags = {
      ...meta,
      keepTurn: true,
    };
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
  }

  private skipOthers(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const skip = { ...(meta.statuses.skipTurn ?? {}) };
    const players = Array.isArray(state.players) ? state.players : [];
    for (const player of players) {
      if (player?.id == null || player.id === playerId) continue;
      skip[player.id] = (skip[player.id] ?? 0) + turns;
    }
    const nextMeta = {
      ...meta,
      statuses: { ...meta.statuses, skipTurn: skip },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private finishGame(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, winnerId: playerId },
      status: 'finished',
    };
    return this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} atteint la planète légendaire !`,
    );
  }

  private move(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const position = meta.positions?.[playerId] ?? 0;
    const newPosition = Math.max(
      0,
      Math.min(position + delta, (meta.tiles?.length ?? 1) - 1),
    );
    return this.setPos(state, playerId, newPosition);
  }

  private setPos(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: MissionGalaxieMetadata = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: pos },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private drawCard(
    meta: MissionGalaxieMetadata,
    deck: MissionGalaxieDeckName,
  ): {
    card: MissionGalaxieChoiceCard | MissionGalaxieEventCard | null;
    meta: MissionGalaxieMetadata;
  } {
    const draw = this.deckPolicies.drawFromPile<
      MissionGalaxieChoiceCard | MissionGalaxieEventCard,
      MissionGalaxieMetadata
    >({
      meta,
      pile: Array.isArray(meta.decks?.[deck]) ? meta.decks[deck] : [],
      discard: Array.isArray(meta.discards?.[deck]) ? meta.discards[deck] : [],
      useWholeMetaRng: true,
      discardDrawnCard: true,
    });
    const nextMeta: MissionGalaxieMetadata = {
      ...draw.meta,
      decks: { ...draw.meta.decks, [deck]: draw.pile as any[] },
      discards: { ...draw.meta.discards, [deck]: draw.discard as any[] },
    };
    return { card: draw.card, meta: nextMeta };
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

  private getMeta(state: GameStateEntity): MissionGalaxieMetadata {
    return (state.metadata ?? {}) as MissionGalaxieMetadata;
  }
}
