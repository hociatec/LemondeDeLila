import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import {
  CAT_PATTES_CARD_BY_ID,
  CatPattesCardDefinition,
} from '../model/cat-pattes-cards';
import type { CatPattesMetadata } from '../model/cat-pattes-state.entity';
import { CAT_PATTES_GOAL } from '../model/cat-pattes-state.entity';
import {
  CAT_PATTES_OBSTACLE_TO_PARADE,
  canPlayPattes,
  playerCanReceiveObstacle,
} from '../rulebook/rulebook';

type CatPattesActionPayload = {
  cardId?: string | null;
  targetPlayerId?: number | null;
  pawnId?: string | null;
  pawn?: string | null;
  value?: string | null;
};

@Injectable()
export class CatPattesActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = this.ensurePawnSelectionPrompt(state);
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim();
      if (type === 'choose_pawn') {
        next = this.handleChoosePawn(next, action);
        next = this.ensurePawnSelectionPrompt(next);
        continue;
      }
      if (type === 'draw') {
        next = this.handleDraw(next);
        continue;
      }
      if (type === 'play_card') {
        next = this.handlePlayCard(next, action);
        continue;
      }
      if (type === 'discard_card' || type === 'pass') {
        next = this.handleDiscard(next, action);
        continue;
      }
    }
    return this.ensurePawnSelectionPrompt(next);
  }

  private handleChoosePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;

    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_pawn') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const payload = (action?.payload ?? {}) as CatPattesActionPayload;
    const rawPawn = payload.pawnId ?? payload.pawn ?? payload.value ?? null;
    const options = Array.isArray(pending?.data?.pawns) ? pending.data.pawns : [];
    const chosen = this.resolvePendingPawn(rawPawn, options);
    if (!chosen) return state;

    const meta = this.getMeta(state);
    const assigned = { ...(meta.pawnByPlayerId ?? {}) } as Record<number, string>;
    if (assigned[playerId]) return state;
    if (Object.values(assigned).some((id) => id === chosen.id)) return state;

    const nextMeta: CatPattesMetadata = {
      ...meta,
      pawns:
        Array.isArray(meta.pawns) && meta.pawns.length > 0
          ? meta.pawns
          : options.map((p: any) => String(p?.label ?? p?.id ?? '').trim()),
      pawnByPlayerId: { ...assigned, [playerId]: chosen.id },
    };

    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: nextMeta,
    };

    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} choisit le pion : ${chosen.label}.`,
    );

    const pendingInfo = this.buildPawnPending(next, playerId);
    if (pendingInfo) {
      const withPending: GameStateEntity = {
        ...next,
        pending: pendingInfo.pending,
        turnIndex: pendingInfo.turnIndex,
        turn: {
          ...(next.turn ?? { direction: 1 }),
          currentPlayerId: pendingInfo.playerId,
          direction: 1,
        },
      };
      return this.ensurePawnSelectionPrompt(withPending);
    }

    next = this.assignMissingBotPawns(next);

    const players = Array.isArray(next.players) ? next.players : [];
    const starterId =
      typeof nextMeta.setupStarterId === 'number'
        ? nextMeta.setupStarterId
        : players[0]?.id ?? null;
    const starterIndex =
      starterId != null ? players.findIndex((p) => p?.id === starterId) : -1;
    const resolvedStarterId =
      starterId != null && starterIndex >= 0 ? starterId : players[0]?.id ?? null;

    let started: GameStateEntity = {
      ...next,
      pending: null,
      turnIndex: starterIndex >= 0 ? starterIndex : next.turnIndex,
      turn: {
        ...(next.turn ?? { direction: 1 }),
        currentPlayerId: resolvedStarterId,
        direction: 1,
      },
    };
    started = this.core.appendLog(
      started,
      `Début de partie : ${this.playerName(started, resolvedStarterId ?? 0)} commence.`,
    );
    return this.appendTurnAnnouncement(started, resolvedStarterId);
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const meta = this.getMeta(state);
    if (meta.drawnPlayerId === currentId) return state;

    const { meta: updatedMeta, cardId } = this.drawForPlayer(meta, currentId);
    let next = this.setMeta(state, { ...updatedMeta, drawnPlayerId: currentId });
    next = this.core.appendLog(next, `${this.playerName(next, currentId)} pioche.`);
    if (cardId) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} pioche ${CAT_PATTES_CARD_BY_ID[cardId]?.name ?? 'une carte'}.`,
      );
    }
    return next;
  }

  private handleDiscard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const meta = this.getMeta(state);
    if (meta.drawnPlayerId !== currentId) return state;

    const payload = (action.payload ?? {}) as CatPattesActionPayload;
    let cardId = String(payload.cardId ?? '').trim();
    const hand = Array.isArray(meta.hands?.[currentId]) ? [...meta.hands[currentId]] : [];
    if (!cardId) cardId = String(hand[0] ?? '').trim();
    if (!cardId || !hand.includes(cardId)) return state;

    let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
    updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
    let next = this.setMeta(state, updatedMeta);
    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} défausse ${CAT_PATTES_CARD_BY_ID[cardId]?.name ?? 'une carte'}.`,
    );
    next = this.clearDrawn(next);
    return this.advanceTurnWithAnnouncement(next);
  }

  private handlePlayCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const payload = (action.payload ?? {}) as CatPattesActionPayload;
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) return state;

    const definition = CAT_PATTES_CARD_BY_ID[cardId];
    if (!definition) return state;

    let meta = this.getMeta(state);
    if (meta.drawnPlayerId !== currentId) return state;
    const hand = Array.isArray(meta.hands?.[currentId]) ? meta.hands[currentId] : [];
    if (!hand.includes(cardId)) return state;

    if (definition.type === 'pattes') {
      if (!canPlayPattes(meta, currentId, definition)) return state;
      const currentPos = Number(meta.positions?.[currentId] ?? 0);
      const delta = Number(definition.value ?? 0);
      if (!Number.isFinite(delta) || currentPos + delta > CAT_PATTES_GOAL) return state;
    }

    if (definition.type === 'obstacle') {
      const targetId =
        typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
      if (targetId == null || targetId === currentId) return state;
      if (!playerCanReceiveObstacle(meta, targetId, definition.obstacle!)) return state;
    }

    let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
    updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
    let next = this.setMeta(state, updatedMeta);

    if (definition.type === 'pattes') {
      next = this.playPattes(next, currentId, definition);
    } else if (definition.type === 'obstacle') {
      const targetId =
        typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
      if (targetId != null) {
        next = this.playObstacle(next, currentId, targetId, definition);
      }
    } else if (definition.type === 'parade') {
      next = this.playParade(next, currentId, definition);
    } else if (definition.type === 'bot') {
      next = this.playBot(next, currentId, definition);
    }

    if (this.getMeta(next).winnerId != null) {
      return this.clearDrawn(next);
    }

    next = this.clearDrawn(next);
    return this.advanceTurnWithAnnouncement(next);
  }

  private playPattes(
    state: GameStateEntity,
    playerId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const positions = { ...(meta.positions ?? {}) };
    const previous = positions[playerId] ?? 0;
    const delta = card.value ?? 0;
    const nextPosition = previous + delta;
    positions[playerId] = nextPosition;

    const turboPlayed = { ...(meta.turboPlayed ?? {}) };
    if ((card.value ?? 0) === 150) {
      turboPlayed[playerId] = (turboPlayed[playerId] ?? 0) + 1;
    }

    let next = this.setMeta(state, {
      ...meta,
      positions,
      turboPlayed,
    });

    next = this.core.appendLog(
      next,
        `${this.playerName(next, playerId)} joue ${card.name} et avance de ${delta} pattes (total ${nextPosition}/${CAT_PATTES_GOAL}).`,
      );

    if (nextPosition === CAT_PATTES_GOAL) {
      const finalMeta = this.getMeta(next);
      const roundPoints = this.computeRoundPoints(next, playerId, finalMeta);
      const points = { ...(finalMeta.points ?? {}) };
      points[playerId] = (points[playerId] ?? 0) + roundPoints;
      next = this.setMeta(next, {
        ...finalMeta,
        points,
        winnerId: playerId,
      });
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} atteint ${CAT_PATTES_GOAL} pattes et remporte la manche (${roundPoints} points).`,
      );
      return { ...next, status: 'finished' };
    }

    return next;
  }

  private computeRoundPoints(
    state: GameStateEntity,
    winnerId: number,
    meta: CatPattesMetadata,
  ): number {
    let points = CAT_PATTES_GOAL;

    const turboCount = Number(meta.turboPlayed?.[winnerId] ?? 0);
    if (turboCount >= 4) points += 200;

    const players = (state.players ?? []).filter((p: any) => p?.id != null);
    const othersBlocked = players
      .filter((p: any) => p.id !== winnerId)
      .every((p: any) => Boolean(meta.obstacles?.[p.id]));
    if (othersBlocked && players.length > 1) points += 100;

    const botCount = Array.isArray(meta.bots?.[winnerId])
      ? meta.bots[winnerId].length
      : 0;
    if (botCount >= 4) points += 300;

    return points;
  }

  private playObstacle(
    state: GameStateEntity,
    playerId: number,
    targetId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    const obstacle = card.obstacle;
    if (!obstacle) return state;

    const meta = this.getMeta(state);
    if (!playerCanReceiveObstacle(meta, targetId, obstacle)) {
      return state;
    }

    const obstacles = { ...(meta.obstacles ?? {}) };
    obstacles[targetId] = obstacle;
    let next = this.setMeta(state, { ...meta, obstacles });
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} inflige ${card.name} à ${this.playerName(next, targetId)}.`,
    );
    return next;
  }

  private playParade(
    state: GameStateEntity,
    playerId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const obstacles = { ...(meta.obstacles ?? {}) };
    const currentObstacle = obstacles[playerId] ?? null;
    if (
      currentObstacle &&
      card.parade &&
      CAT_PATTES_OBSTACLE_TO_PARADE[currentObstacle] === card.parade
    ) {
      obstacles[playerId] = null;
      meta = { ...meta, obstacles };
      next = this.setMeta(next, meta);
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} neutralise ${currentObstacle} avec ${card.name}.`,
      );
      meta = this.getMeta(next);
    }

    if (card.parade === 'rayon') {
      const hasSun = { ...(meta.hasSun ?? {}) };
      hasSun[playerId] = true;
      meta = { ...meta, hasSun };
      next = this.setMeta(next, meta);
    }

    return next;
  }

  private playBot(
    state: GameStateEntity,
    playerId: number,
    card: CatPattesCardDefinition,
  ): GameStateEntity {
    const bot = card.bot;
    if (!bot) return state;
    const meta = this.getMeta(state);
    const bots = { ...(meta.bots ?? {}) };
    const playerBots = [...(bots[playerId] ?? [])];
    if (!playerBots.includes(bot)) {
      playerBots.push(bot);
    }
    bots[playerId] = playerBots;
    let next = this.setMeta(state, { ...meta, bots });
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} active ${card.name}.`,
    );
    return next;
  }

  private clearDrawn(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    return this.setMeta(state, { ...meta, drawnPlayerId: null });
  }

  private drawForPlayer(
    meta: CatPattesMetadata,
    playerId: number,
  ): { meta: CatPattesMetadata; cardId: string | null } {
    const { cardId, meta: withCard } = this.drawOneCard(meta);
    if (!cardId) {
      return { meta: withCard, cardId: null };
    }
    const hands = { ...(withCard.hands ?? {}) };
    const playerHand = [...(hands[playerId] ?? [])];
    playerHand.push(cardId);
    hands[playerId] = playerHand;
    return {
      meta: {
        ...withCard,
        hands,
      },
      cardId,
    };
  }

  private drawOneCard(meta: CatPattesMetadata): {
    meta: CatPattesMetadata;
    cardId: string | null;
  } {
    let { deck, discard, rng } = meta;
    const safeDeck = Array.isArray(deck) ? [...deck] : [];
    const safeDiscard = Array.isArray(discard) ? [...discard] : [];
    let currentMeta = { ...meta, deck: safeDeck, discard: safeDiscard };
    if (safeDeck.length === 0 && safeDiscard.length > 0) {
      const { values, meta: shuffledMeta } = this.random.shuffle(rng ?? {}, safeDiscard);
      currentMeta = {
        ...currentMeta,
        deck: values,
        discard: [],
        rng: shuffledMeta,
      };
      rng = shuffledMeta;
    }
    const nextDeck = currentMeta.deck ?? [];
    if (!nextDeck.length) {
      return { meta: currentMeta, cardId: null };
    }
    const [cardId, ...rest] = nextDeck;
    return {
      cardId,
      meta: { ...currentMeta, deck: rest },
    };
  }

  private removeCardFromHand(
    meta: CatPattesMetadata,
    playerId: number,
    cardId: string,
  ): CatPattesMetadata {
    const hands = { ...(meta.hands ?? {}) };
    const playerHand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
    const index = playerHand.indexOf(cardId);
    if (index >= 0) {
      playerHand.splice(index, 1);
    }
    hands[playerId] = playerHand;
    return { ...meta, hands };
  }

  private addCardToDiscard(
    meta: CatPattesMetadata,
    cardId: string,
  ): CatPattesMetadata {
    const discard = [...(meta.discard ?? []), cardId];
    return { ...meta, discard };
  }

  private getMeta(state: GameStateEntity): CatPattesMetadata {
    return (state.metadata ?? {}) as CatPattesMetadata;
  }

  private setMeta(
    state: GameStateEntity,
    metadata: CatPattesMetadata,
  ): GameStateEntity {
    return { ...state, metadata };
  }

  private playerName(state: GameStateEntity, playerId: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const p = players.find((player) => player?.id === playerId);
    return p?.username?.trim() || `Joueur ${playerId}`;
  }

  private buildPawnPending(
    state: GameStateEntity,
    startId: number | null,
  ): { pending: any; playerId: number; turnIndex: number } | null {
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return null;

    const meta = this.getMeta(state);
    const pawnByPlayerId = (meta.pawnByPlayerId ?? {}) as Record<number, string>;
    const startIndex =
      startId != null ? players.findIndex((p) => p?.id === startId) : -1;
    const baseIndex = startIndex >= 0 ? startIndex : 0;
    let nextIndex = -1;
    for (let i = 0; i < players.length; i += 1) {
      const idx = (baseIndex + i) % players.length;
      const pid = players[idx]?.id;
      if (pid == null) continue;
      if (!pawnByPlayerId[pid] && !this.isBotLike(players[idx])) {
        nextIndex = idx;
        break;
      }
    }
    if (nextIndex < 0) return null;

    const used = new Set(
      Object.values(pawnByPlayerId).filter((v) => typeof v === 'string'),
    );
    const choices = (meta.pawns ?? []).filter((p) => !used.has(p));
    if (!choices.length) return null;

    const chooserId = players[nextIndex].id;
    const chooserLabel = this.playerName(state, chooserId);
    return {
      playerId: chooserId,
      turnIndex: nextIndex,
      pending: {
        type: 'choose_pawn',
        playerId: chooserId,
        blocking: true,
        label: `C'est à ${chooserLabel} de choisir son pion.`,
        choices,
        data: {
          pawns: choices.map((name) => ({ id: name, label: name })),
        },
      },
    };
  }

  private resolvePendingPawn(
    raw: unknown,
    options: Array<{ id?: string; label?: string }>,
  ): { id: string; label: string } | null {
    if (!Array.isArray(options) || options.length === 0) return null;
    const normalized = options
      .map((p: any) => ({
        id: String(p?.id ?? '').trim(),
        label: String(p?.label ?? '').trim(),
      }))
      .filter((p) => p.id.length > 0 && p.label.length > 0);
    if (!normalized.length) return null;

    const value =
      typeof raw === 'object'
        ? (raw as any)?.id ?? (raw as any)?.pawnId ?? (raw as any)?.value ?? raw
        : raw;
    const key = this.normalizePawnKey(value);
    if (!key) return null;

    const byId = normalized.find((p) => this.normalizePawnKey(p.id) === key);
    if (byId) return byId;
    const byLabel = normalized.find(
      (p) => this.normalizePawnKey(p.label) === key,
    );
    return byLabel ?? null;
  }

  private normalizePawnKey(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  private appendTurnAnnouncement(
    state: GameStateEntity,
    playerId: number | null | undefined,
  ): GameStateEntity {
    if (typeof playerId !== 'number' || !Number.isFinite(playerId)) return state;
    return this.core.appendLog(
      state,
      `C'est au tour de ${this.playerName(state, playerId)}.`,
    );
  }

  private advanceTurnWithAnnouncement(state: GameStateEntity): GameStateEntity {
    const next = this.turns.advanceTurn(state);
    return this.appendTurnAnnouncement(next, next.turn?.currentPlayerId ?? null);
  }

  private ensurePawnSelectionPrompt(state: GameStateEntity): GameStateEntity {
    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_pawn') return state;
    const chooserId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (chooserId == null) return state;
    return this.appendLogOnce(
      state,
      `${this.playerName(state, chooserId)} doit choisir un pion.`,
    );
  }

  private appendLogOnce(state: GameStateEntity, message: string): GameStateEntity {
    const log = Array.isArray(state.log) ? state.log : [];
    const last = String(log[log.length - 1]?.message ?? '').trim();
    if (last === message) return state;
    return this.core.appendLog(state, message);
  }

  private assignMissingBotPawns(state: GameStateEntity): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const meta = this.getMeta(state);
    const assigned = { ...(meta.pawnByPlayerId ?? {}) } as Record<number, string>;
    const used = new Set(
      Object.values(assigned).filter((v) => typeof v === 'string' && v.trim().length > 0),
    );
    const pawns = Array.isArray(meta.pawns) ? [...meta.pawns] : [];

    let next = state;
    let changed = false;
    for (const player of players) {
      if (!player?.id || !this.isBotLike(player)) continue;
      if (assigned[player.id]) continue;
      const nextPawn = pawns.find((pawn) => !used.has(pawn));
      if (!nextPawn) break;
      assigned[player.id] = nextPawn;
      used.add(nextPawn);
      changed = true;
      next = this.core.appendLog(
        next,
        `${this.playerName(next, player.id)} choisit le pion : ${nextPawn}.`,
      );
    }

    if (!changed) return state;
    return this.setMeta(next, { ...this.getMeta(next), pawnByPlayerId: assigned });
  }

  private isBotLike(player: any): boolean {
    if (!player) return false;
    if (player.isBot === true) return true;
    const username = String(player?.username ?? '').toLowerCase();
    return username.includes('bot');
  }
}
