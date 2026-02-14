import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import type {
  ToutPresDeMamanCard,
  ToutPresDeMamanMetadata,
  ToutPresDeMamanTile,
} from '../model/tout-pres-de-maman-state.entity';

@Injectable()
export class ToutPresDeMamanActionService {
  private static readonly TOKENS_TO_WIN = 3;
  private static readonly MAX_DEPTH = 12;

  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly deckPolicies: DeckPoliciesService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim().toLowerCase();
      if (type === 'roll' || type === 'roll_dice' || type === 'roll dice') {
        next = this.handleRoll(next);
      }
    }
    return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;

    const playerId = state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const meta = this.getMeta(state);
    const skip = meta.statuses.skipTurn?.[playerId] ?? 0;
    if (skip > 0) {
      const updatedMeta: ToutPresDeMamanMetadata = {
        ...meta,
        statuses: {
          ...meta.statuses,
          skipTurn: {
            ...(meta.statuses?.skipTurn ?? {}),
            [playerId]: skip - 1,
          },
        },
      };
      const next = this.replaceMeta(state, updatedMeta);
      return this.turns.advanceTurn(
        this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} reste sur place (tour sauté).`,
        ),
      );
    }

    let nextMeta: ToutPresDeMamanMetadata = { ...meta };
    const roll1 = this.random.rollDice(nextMeta as any, 6);
    nextMeta = { ...nextMeta, ...roll1.meta };
    let total = roll1.roll;
    const hasBonus =
      Boolean(nextMeta.statuses?.bonusReroll?.[playerId]) ?? false;
    if (hasBonus) {
      nextMeta.statuses = {
        ...nextMeta.statuses,
        bonusReroll: {
          ...(nextMeta.statuses?.bonusReroll ?? {}),
          [playerId]: false,
        },
      };
      const reroll = this.random.rollDice(nextMeta as any, 6);
      nextMeta = { ...nextMeta, ...reroll.meta };
      total += reroll.roll;
    }

    let next = this.replaceMeta(state, nextMeta);
    next = {
      ...next,
      lastRoll: total,
    };

    const positions = nextMeta.positions ?? {};
    const startIndex = positions[playerId] ?? 0;
    const finishIndex = (nextMeta.tiles?.length ?? 1) - 1;
    let target = startIndex + total;
    if (target > finishIndex) {
      const over = target - finishIndex;
      target = Math.max(0, finishIndex - over);
    }

    next = this.setPlayerPosition(next, playerId, target);
    const tile = this.getTileByIndex(this.getMeta(next), target);
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} avance de ${total} case(s) et place ${this.pawnLabel(next, playerId)} en case ${target + 1} (${tile?.title ?? `case ${target + 1}`}).`,
    );

    next = this.applyTileEffects(next, playerId, target, 0);
    if ((next.status ?? '').toLowerCase() === 'finished') {
      return next;
    }

    return this.turns.advanceTurn(next);
  }

  private applyTileEffects(
    state: GameStateEntity,
    playerId: number,
    index: number,
    depth: number,
  ): GameStateEntity {
    if (depth > ToutPresDeMamanActionService.MAX_DEPTH) {
      return state;
    }
    const meta = this.getMeta(state);
    const tile = this.getTileByIndex(meta, index);
    if (!tile) return state;

    let next = state;
    switch (tile.type) {
      case 'start':
        next = this.gainTokens(next, playerId, 2);
        break;
      case 'token':
        next = this.gainTokens(next, playerId, 1);
        break;
      case 'card':
        next = this.drawAndApplyCard(next, playerId, depth + 1);
        break;
      case 'bonds':
        return this.moveAndApply(next, playerId, 2, depth + 1);
      case 'slide':
        return this.moveAndApply(next, playerId, -2, depth + 1);
      case 'storm':
      case 'nest':
        return this.addSkip(next, playerId, 1, tile);
      case 'meeting':
        return this.handleMeeting(next, playerId, depth + 1);
      case 'finish':
        return this.handleFinish(next, playerId, index, depth + 1);
      default:
        break;
    }

    return next;
  }

  private drawAndApplyCard(
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ): GameStateEntity {
    const draw = this.drawCard(state);
    let next = draw.state;
    const card = draw.card;
    if (!card) {
      return this.core.appendLog(
        next,
        'Aucune carte disponible pour le moment.',
      );
    }

    next = this.core.appendLog(next, `Carte : ${card.text}`);
    return this.applyCardEffect(next, playerId, card, depth);
  }

  private applyCardEffect(
    state: GameStateEntity,
    playerId: number,
    card: ToutPresDeMamanCard,
    depth: number,
  ): GameStateEntity {
    if (depth > ToutPresDeMamanActionService.MAX_DEPTH) {
      return state;
    }

    switch (card.id) {
      case 1:
        return this.moveAndApply(state, playerId, 1, depth + 1);
      case 2:
        return this.moveAndApply(state, playerId, -1, depth + 1);
      case 3:
        return this.gainTokens(state, playerId, 1);
      case 4:
        return this.moveAndApply(state, playerId, 2, depth + 1);
      case 5:
        return this.addSkip(state, playerId, 1, card);
      case 6:
        return this.moveAndApply(state, playerId, -2, depth + 1);
      case 7:
        return this.moveToNextType(state, playerId, 'card', depth + 1);
      case 8:
        return this.transferToken(state, playerId);
      case 9:
        return this.moveToPreviousType(state, playerId, 'token', depth + 1);
      case 10:
        return this.moveAllPlayers(state, -1, depth + 1);
      case 11:
        return this.setBonusReroll(state, playerId);
      case 12:
        return this.gainTokens(state, playerId, 1);
      case 13:
        return this.addSkip(state, playerId, 1, card);
      case 14:
        return this.moveAndApply(state, playerId, 3, depth + 1);
      case 15:
        return this.moveToPreviousType(state, playerId, 'bonds', depth + 1);
      case 16:
        return this.rollAndAdvance(state, playerId, depth + 1);
      case 17:
        return this.moveAndApply(state, playerId, -1, depth + 1);
      case 18:
        return this.moveAndApply(state, playerId, 2, depth + 1);
      case 19:
        return this.moveAndApply(state, playerId, -2, depth + 1);
      case 20:
        return this.gainTokens(state, playerId, 1);
      case 21:
        return this.moveAllPlayers(state, 1, depth + 1);
      case 22:
        return this.addSkip(state, playerId, 1, card);
      case 23:
        return this.rollAndMaybeAdvance(state, playerId, depth + 1);
      case 24:
        return this.moveToNextType(state, playerId, 'bonds', depth + 1);
      case 25:
        return this.loseToken(state, playerId);
      case 26:
        return this.shareAdvance(state, playerId, depth + 1);
      case 27:
        return state;
      case 28:
        return this.addSkip(state, playerId, 1, card);
      case 29: {
        const afterMove = this.moveAndApply(state, playerId, 2, depth + 1);
        return this.gainTokens(afterMove, playerId, 1);
      }
      case 30:
        return this.moveAndApply(state, playerId, 1, depth + 1);
      default:
        return state;
    }
  }

  private handleMeeting(
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const pos = meta.positions?.[playerId] ?? 0;
    const others = (state.players ?? [])
      .filter((p) => p?.id != null && p.id !== playerId)
      .filter((p) => (meta.positions?.[p.id ?? 0] ?? -1) === pos);
    let next = state;
    if (others.length) {
      next = this.core.appendLog(
        next,
        `Rencontre : ${this.playerName(next, playerId)} avance avec ses amis.`,
      );
      for (const other of others) {
        next = this.moveAndApply(next, other.id, 1, depth + 1);
      }
    }
    return next;
  }

  private handleFinish(
    state: GameStateEntity,
    playerId: number,
    index: number,
    depth: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const tokens = meta.tokens?.[playerId] ?? 0;
    if (tokens >= ToutPresDeMamanActionService.TOKENS_TO_WIN) {
      let next = this.setWinner(state, playerId, tokens);
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} retrouve maman avec ${tokens} jetons eucalyptus !`,
      );
      return next;
    }
    const deficit =
      ToutPresDeMamanActionService.TOKENS_TO_WIN - tokens;
    const rewind =
      Math.min(index, deficit);
    const newIndex = Math.max(0, index - rewind);
    const next = this.core.appendLog(
      state,
      `${this.playerName(
        state,
        playerId,
      )} manque de jetons et recule de ${rewind} case(s) pour en retrouver.`,
    );
    const reposition = this.setPlayerPosition(next, playerId, newIndex);
    return this.applyTileEffects(
      reposition,
      playerId,
      this.getPlayerPosition(reposition, playerId),
      depth + 1,
    );
  }

  private setWinner(
    state: GameStateEntity,
    playerId: number,
    tokens: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const updatedMeta: ToutPresDeMamanMetadata = {
      ...meta,
      winnerId: playerId,
    };
    return {
      ...state,
      status: 'finished',
      metadata: { ...(state.metadata ?? {}), ...updatedMeta },
    };
  }

  private moveAndApply(
    state: GameStateEntity,
    playerId: number,
    delta: number,
    depth: number,
  ): GameStateEntity {
    if (delta === 0) return state;
    const meta = this.getMeta(state);
    const current = meta.positions?.[playerId] ?? 0;
    const target = Math.max(
      0,
      Math.min(
        (meta.tiles?.length ?? 1) - 1,
        current + delta,
      ),
    );
    const next = this.setPlayerPosition(state, playerId, target);
    return this.applyTileEffects(next, playerId, target, depth);
  }

  private setPlayerPosition(
    state: GameStateEntity,
    playerId: number,
    index: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const updatedPositions = {
      ...(meta.positions ?? {}),
      [playerId]: index,
    };
    const updatedMeta: ToutPresDeMamanMetadata = {
      ...meta,
      positions: updatedPositions,
    };
    return this.replaceMeta(state, updatedMeta);
  }

  private gainTokens(
    state: GameStateEntity,
    playerId: number,
    amount: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.tokens?.[playerId] ?? 0;
    const updatedMeta: ToutPresDeMamanMetadata = {
      ...meta,
      tokens: {
        ...(meta.tokens ?? {}),
        [playerId]: current + amount,
      },
    };
    const next = this.replaceMeta(state, updatedMeta);
    return this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} gagne ${amount} jeton(s) eucalyptus.`,
    );
  }

  private loseToken(state: GameStateEntity, playerId: number): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.tokens?.[playerId] ?? 0;
    if (current <= 0) {
      return this.core.appendLog(
        state,
        `${this.playerName(state, playerId)} n’a pas de jeton à perdre.`,
      );
    }
    const updatedMeta: ToutPresDeMamanMetadata = {
      ...meta,
      tokens: {
        ...(meta.tokens ?? {}),
        [playerId]: current - 1,
      },
    };
    const next = this.replaceMeta(state, updatedMeta);
    return this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} perd un jeton eucalyptus.`,
    );
  }

  private addSkip(
    state: GameStateEntity,
    playerId: number,
    amount: number,
    tileOrCard: { title?: string } | ToutPresDeMamanCard,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.statuses.skipTurn?.[playerId] ?? 0;
    const updatedMeta: ToutPresDeMamanMetadata = {
      ...meta,
      statuses: {
        ...meta.statuses,
        skipTurn: {
          ...(meta.statuses?.skipTurn ?? {}),
          [playerId]: current + amount,
        },
      },
    };
    const next = this.replaceMeta(state, updatedMeta);
    const label =
      'text' in tileOrCard
        ? `carte ${tileOrCard.id}`
        : tileOrCard?.title ?? 'effet spécial';
    return this.core.appendLog(
      next,
      `${this.playerName(
        next,
        playerId,
      )} perd ${amount} tour(s) (${label}).`,
    );
  }

  private setBonusReroll(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const updatedMeta: ToutPresDeMamanMetadata = {
      ...meta,
      statuses: {
        ...meta.statuses,
        bonusReroll: {
          ...(meta.statuses?.bonusReroll ?? {}),
          [playerId]: true,
        },
      },
    };
    const next = this.replaceMeta(state, updatedMeta);
    return this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} pourra relancer le dé au prochain tour.`,
    );
  }

  private moveAllPlayers(
    state: GameStateEntity,
    delta: number,
    depth: number,
  ): GameStateEntity {
    let next = state;
    for (const player of state.players ?? []) {
      if (!player?.id) continue;
      next = this.moveAndApply(next, player.id, delta, depth + 1);
    }
    return next;
  }

  private moveToNextType(
    state: GameStateEntity,
    playerId: number,
    type: ToutPresDeMamanTile['type'],
    depth: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.positions?.[playerId] ?? 0;
    const tiles = meta.tiles ?? [];
    for (let idx = current + 1; idx < tiles.length; idx += 1) {
      if (tiles[idx]?.type === type) {
        const next = this.setPlayerPosition(state, playerId, idx);
        return this.applyTileEffects(next, playerId, idx, depth);
      }
    }
    return state;
  }

  private moveToPreviousType(
    state: GameStateEntity,
    playerId: number,
    type: ToutPresDeMamanTile['type'],
    depth: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.positions?.[playerId] ?? 0;
    const tiles = meta.tiles ?? [];
    for (let idx = current - 1; idx >= 0; idx -= 1) {
      if (tiles[idx]?.type === type) {
        const next = this.setPlayerPosition(state, playerId, idx);
        return this.applyTileEffects(next, playerId, idx, depth);
      }
    }
    return state;
  }

  private transferToken(state: GameStateEntity, playerId: number): GameStateEntity {
    const targetId = this.pickOtherPlayer(state, playerId);
    const meta = this.getMeta(state);
    const current = meta.tokens?.[playerId] ?? 0;
    if (!targetId || current <= 0) {
      return state;
    }
    const other = meta.tokens?.[targetId] ?? 0;
    const updatedMeta: ToutPresDeMamanMetadata = {
      ...meta,
      tokens: {
        ...(meta.tokens ?? {}),
        [playerId]: current - 1,
        [targetId]: other + 1,
      },
    };
    const next = this.replaceMeta(state, updatedMeta);
    return this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} partage un jeton avec ${this.playerName(
        next,
        targetId,
      )}.`,
    );
  }

  private shareAdvance(
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ): GameStateEntity {
    let next = this.moveAndApply(state, playerId, 1, depth);
    const partnerId = this.pickOtherPlayer(state, playerId);
    if (partnerId) {
      next = this.moveAndApply(next, partnerId, 1, depth);
    }
    return next;
  }

  private rollAndAdvance(
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const roll = this.random.rollDice(meta as any, 6);
    let nextMeta = { ...meta, ...roll.meta };
    let next = this.replaceMeta(state, nextMeta);
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} relance le dé et avance de ${roll.roll}.`,
    );
    return this.moveAndApply(next, playerId, roll.roll, depth);
  }

  private rollAndMaybeAdvance(
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const roll = this.random.rollDice(meta as any, 6);
    let next = this.replaceMeta(state, { ...meta, ...roll.meta });
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} fait ${roll.roll} au dé.`,
    );
    if (roll.roll >= 4) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} avance d’une case grâce à la réussite.`,
      );
      return this.moveAndApply(next, playerId, 1, depth);
    }
    return next;
  }

  private drawCard(state: GameStateEntity): {
    state: GameStateEntity;
    card: ToutPresDeMamanCard | null;
  } {
    const meta = this.getMeta(state);
    const draw = this.deckPolicies.drawFromPile<number, ToutPresDeMamanMetadata>({
      meta,
      pile: Array.isArray(meta.deckCards) ? meta.deckCards : [],
      discard: Array.isArray(meta.discardCards) ? meta.discardCards : [],
      useWholeMetaRng: true,
      discardDrawnCard: true,
    });
    const nextMeta: ToutPresDeMamanMetadata = {
      ...draw.meta,
      deckCards: draw.pile as number[],
      discardCards: draw.discard as number[],
    };
    const next = this.replaceMeta(state, nextMeta);
    const cardId = draw.card;
    const card = nextMeta.cards.find((entry) => entry.id === cardId) ?? null;
    return { state: next, card };
  }

  private replaceMeta(
    state: GameStateEntity,
    meta: ToutPresDeMamanMetadata,
  ): GameStateEntity {
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };
  }

  private getMeta(state: GameStateEntity): ToutPresDeMamanMetadata {
    return (state.metadata ?? {}) as ToutPresDeMamanMetadata;
  }

  private getTileByIndex(
    meta: ToutPresDeMamanMetadata,
    index: number,
  ): ToutPresDeMamanTile | null {
    const tiles = meta.tiles ?? [];
    if (index < 0 || index >= tiles.length) return null;
    return tiles[index];
  }

  private getPlayerPosition(
    state: GameStateEntity,
    playerId: number,
  ): number {
    const meta = this.getMeta(state);
    return meta.positions?.[playerId] ?? 0;
  }

  private pickOtherPlayer(
    state: GameStateEntity,
    playerId: number,
  ): number | null {
    const candidates = Array.isArray(state.players)
      ? state.players.filter((p) => p?.id && p.id !== playerId)
      : [];
    return candidates.length ? candidates[0].id ?? null : null;
  }

  private playerName(state: GameStateEntity, playerId: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const player = players.find((p) => p?.id === playerId);
    if (!player) return `Joueur ${playerId}`;
    const username =
      typeof player.username === 'string' && player.username.trim()
        ? player.username.trim()
        : null;
    return username ?? `Joueur ${playerId}`;
  }

  private pawnLabel(state: GameStateEntity, playerId: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const player: any = players.find((p) => p?.id === playerId);

    const explicitLabel = String(player?.pawnLabel ?? '').trim();
    if (explicitLabel) return `"${explicitLabel}"`;

    const pawnId = String(player?.pawn ?? '').trim();
    if (pawnId) return `"${pawnId}"`;

    const fallback = this.playerName(state, playerId);
    return `"${fallback}"`;
  }
}
