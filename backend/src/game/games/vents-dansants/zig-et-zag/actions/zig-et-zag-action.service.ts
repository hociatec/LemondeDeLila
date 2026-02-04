import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import type {
  ZigEtZagMetadata,
  ZigEtZagPlayerPlay,
  ZigEtZagRoundSummary,
} from '../model/zig-et-zag-state.entity';
import {
  ZIG_ET_ZAG_CARD_BY_ID,
  ZIG_ET_ZAG_TOTAL_CARDS,
} from '../model/zig-et-zag-cards';

type FaceUpValue = {
  playerId: number;
  value: number;
};

type BattleResult = {
  meta: ZigEtZagMetadata;
  winnerId: number | null;
  battleLog: string[];
};

@Injectable()
export class ZigEtZagActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim();
      if (type === 'play_round') {
        next = this.handlePlayRound(next);
      }
    }
    return next;
  }

  private handlePlayRound(state: GameStateEntity): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) {
      return state;
    }
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) {
      return state;
    }

    let meta = this.getMeta(state);
    if (meta.winnerId != null) {
      return state;
    }

    const preWinner = this.detectWinner(meta, players);
    if (preWinner != null) {
      return this.finishGame(state, preWinner);
    }

    const { meta: roundMeta, summary } = this.resolveRound(meta, players);
    let next = this.setMeta(state, { ...roundMeta, lastRound: summary });
    next = this.logRound(next, summary, players);

    const finalWinner = this.detectWinner(roundMeta, players);
    if (finalWinner != null) {
      const finishedMeta = { ...roundMeta, winnerId: finalWinner };
      next = this.setMeta({ ...next, status: 'finished' }, finishedMeta);
      next = this.core.appendLog(
        next,
        `${this.playerName(players, finalWinner)} remporte Zig et Zag !`,
      );
      return next;
    }

    return this.turns.advanceTurn(next);
  }

  private resolveRound(
    meta: ZigEtZagMetadata,
    players: GameStateEntity['players'],
  ): { meta: ZigEtZagMetadata; summary: ZigEtZagRoundSummary } {
    let nextMeta = { ...meta };
    const playableIds = (players ?? [])
      .filter((player) => typeof player?.id === 'number')
      .map((player) => player!.id);
    const plays: ZigEtZagPlayerPlay[] = playableIds.map((pid) => ({
      playerId: pid,
      playedCards: [],
    }));

    for (const entry of plays) {
      const { cardId, meta: updated } = this.drawTopCard(nextMeta, entry.playerId);
      nextMeta = updated;
      if (!cardId) {
        entry.lostByNoCard = true;
        continue;
      }
      entry.playedCards.push(cardId);
      entry.faceUpCard = cardId;
    }

    const winnerAfterMissing = this.findWinnerAfterMissingCards(plays);
    if (winnerAfterMissing != null) {
      const tableCards = this.collectTableCards(plays);
      nextMeta = this.addCardsToPlayerDeck(nextMeta, winnerAfterMissing, tableCards);
      const summary: ZigEtZagRoundSummary = {
        winnerId: winnerAfterMissing,
        cardsWon: tableCards.length,
        plays,
        battleLog: [
          `${this.playerName(players, winnerAfterMissing)} gagne la manche car un adversaire n'a plus de cartes.`,
        ],
      };
      return { meta: nextMeta, summary };
    }

    const faceValues = this.evaluateFaceUpPlays(plays);
    if (!faceValues.length) {
      const summary: ZigEtZagRoundSummary = {
        winnerId: null,
        cardsWon: 0,
        plays,
        battleLog: ['Aucune carte n\'a été jouée.'],
      };
      return { meta: nextMeta, summary };
    }

    const maxValue = Math.max(...faceValues.map((item) => item.value));
    const tiedPlayers = faceValues
      .filter((item) => item.value === maxValue)
      .map((item) => item.playerId);

    let battleLog: string[] = [];
    let roundWinner: number | null = null;

    if (tiedPlayers.length === 1) {
      roundWinner = tiedPlayers[0];
    } else {
      const triggerColors = faceValues.reduce((acc, item) => {
        const entry = plays.find((play) => play.playerId === item.playerId);
        if (entry?.faceUpCard) {
          const def = ZIG_ET_ZAG_CARD_BY_ID[entry.faceUpCard];
          if (def?.color) {
            acc[item.playerId] = def.color;
          }
        }
        return acc;
      }, {} as Record<number, string>);
      const battleResult = this.conductBattle(
        nextMeta,
        plays,
        tiedPlayers,
        triggerColors,
        players,
      );
      nextMeta = battleResult.meta;
      roundWinner = battleResult.winnerId;
      battleLog = battleResult.battleLog;
    }

    if (roundWinner == null) {
      const summary: ZigEtZagRoundSummary = {
        winnerId: null,
        cardsWon: this.collectTableCards(plays).length,
        plays,
        battleLog,
      };
      return { meta: nextMeta, summary };
    }

    const tableCards = this.collectTableCards(plays);
    nextMeta = this.addCardsToPlayerDeck(nextMeta, roundWinner, tableCards);
    const summary: ZigEtZagRoundSummary = {
      winnerId: roundWinner,
      cardsWon: tableCards.length,
      plays,
      battleLog,
    };
    return { meta: nextMeta, summary };
  }

  private conductBattle(
    meta: ZigEtZagMetadata,
    plays: ZigEtZagPlayerPlay[],
    tiedPlayers: number[],
    triggerColors: Record<number, string>,
    players: GameStateEntity['players'],
  ): BattleResult {
    let nextMeta = { ...meta };
    let activePlayers = [...tiedPlayers];
    const battleLog: string[] = [];
    battleLog.push('Bataille déclenchée !');

    while (activePlayers.length > 0) {
      for (const playerId of activePlayers) {
        const { cardId, meta: updated } = this.drawTopCard(nextMeta, playerId);
        nextMeta = updated;
        const entry = plays.find((play) => play.playerId === playerId);
        if (!entry) continue;
        if (!cardId) {
          entry.lostByNoCard = true;
          battleLog.push(
            `${this.playerName(players, playerId)} n'a plus de cartes pour continuer la bataille.`,
          );
          const winner = activePlayers.find((id) => id !== playerId) ?? null;
          return { meta: nextMeta, winnerId: winner, battleLog };
        }
        entry.playedCards.push(cardId);
        battleLog.push(
          `${this.playerName(players, playerId)} place une carte face cachée.`,
        );
      }

      const faceUpResults: FaceUpValue[] = [];
      for (const playerId of activePlayers) {
        const { cardId, meta: updated } = this.drawTopCard(nextMeta, playerId);
        nextMeta = updated;
        const entry = plays.find((play) => play.playerId === playerId);
        if (!entry) continue;
        if (!cardId) {
          entry.lostByNoCard = true;
          battleLog.push(
            `${this.playerName(players, playerId)} ne peut pas révéler de carte et perd la bataille.`,
          );
          const winner = activePlayers.find((id) => id !== playerId) ?? null;
          return { meta: nextMeta, winnerId: winner, battleLog };
        }
        entry.playedCards.push(cardId);
        entry.faceUpCard = cardId;
        const def = ZIG_ET_ZAG_CARD_BY_ID[cardId];
        const isJoker = def?.type === 'joker';
        const matchesColor = Boolean(
          def?.color && triggerColors[playerId] && def.color === triggerColors[playerId],
        );
        entry.invalidJoker = isJoker && !matchesColor;
        battleLog.push(
          `${this.playerName(players, playerId)} révèle ${this.formatCardLabel(cardId)}${
            entry.invalidJoker ? ' (joker invalide)' : ''
          }.`,
        );
        const value = entry.invalidJoker ? -1 : def?.value ?? -1;
        faceUpResults.push({ playerId, value });
        if (def?.color) {
          triggerColors[playerId] = def.color;
        }
      }

      const validResults = faceUpResults.filter((result) => result.value >= 0);
      if (!validResults.length) {
        battleLog.push(
          'Aucun joueur n\'a réussi à poser une carte valide pendant la bataille ; le premier participant l\'emporte.',
        );
        return { meta: nextMeta, winnerId: activePlayers[0] ?? null, battleLog };
      }

      const maxValue = Math.max(...validResults.map((result) => result.value));
      const winners = validResults
        .filter((result) => result.value === maxValue)
        .map((result) => result.playerId);

      if (winners.length === 1) {
        const winnerId = winners[0];
        battleLog.push(
          `${this.playerName(players, winnerId)} remporte la bataille.`,
        );
        return { meta: nextMeta, winnerId, battleLog };
      }

      battleLog.push('Égalité persistante, la bataille continue !');
      activePlayers = winners;
    }

    return { meta: nextMeta, winnerId: null, battleLog };
  }

  private logRound(
    state: GameStateEntity,
    summary: ZigEtZagRoundSummary,
    players: GameStateEntity['players'],
  ): GameStateEntity {
    let next = state;
    const revealMessages = summary.plays
      .map((play) => {
        const cardLabel = play.faceUpCard
          ? this.formatCardLabel(play.faceUpCard)
          : null;
        if (play.lostByNoCard) {
          return `${this.playerName(players, play.playerId)} n'a plus de cartes.`;
        }
        if (cardLabel) {
          return `${this.playerName(players, play.playerId)} dévoile ${cardLabel}.`;
        }
        return null;
      })
      .filter(Boolean);
    if (revealMessages.length) {
      next = this.core.appendLog(next, revealMessages.join(' '));
    }
    for (const message of summary.battleLog) {
      next = this.core.appendLog(next, message);
    }
    if (summary.winnerId != null && summary.cardsWon > 0) {
      next = this.core.appendLog(
        next,
        `${this.playerName(players, summary.winnerId)} remporte ${summary.cardsWon} cartes.`,
      );
    }
    return next;
  }

  private collectTableCards(plays: ZigEtZagPlayerPlay[]): string[] {
    return plays.flatMap((entry) => entry.playedCards);
  }

  private evaluateFaceUpPlays(plays: ZigEtZagPlayerPlay[]): FaceUpValue[] {
    return plays
      .filter((entry) => entry.faceUpCard)
      .map((entry) => {
        const def = ZIG_ET_ZAG_CARD_BY_ID[entry.faceUpCard!];
        return {
          playerId: entry.playerId,
          value: def?.value ?? -1,
        };
      })
      .filter((item) => item.value >= 0);
  }

  private findWinnerAfterMissingCards(plays: ZigEtZagPlayerPlay[]): number | null {
    const alive = plays.filter((entry) => !entry.lostByNoCard);
    if (alive.length === 1) {
      return alive[0].playerId;
    }
    return null;
  }

  private detectWinner(
    meta: ZigEtZagMetadata,
    players: GameStateEntity['players'],
  ): number | null {
    const decks = meta.playerDecks ?? {};
    const playerIds = (players ?? [])
      .filter((player) => typeof player?.id === 'number')
      .map((player) => player!.id);
    const alive = playerIds.filter((pid) => (decks[pid]?.length ?? 0) > 0);
    if (alive.length === 1) {
      return alive[0];
    }
    const totalOwner = playerIds.find(
      (pid) => (decks[pid]?.length ?? 0) === ZIG_ET_ZAG_TOTAL_CARDS,
    );
    return totalOwner ?? null;
  }

  private drawTopCard(
    meta: ZigEtZagMetadata,
    playerId: number,
  ): { meta: ZigEtZagMetadata; cardId: string | null } {
    const decks = { ...meta.playerDecks };
    const playerDeck = Array.isArray(decks[playerId]) ? [...decks[playerId]] : [];
    if (!playerDeck.length) {
      decks[playerId] = playerDeck;
      return { meta: { ...meta, playerDecks: decks }, cardId: null };
    }
    const [cardId, ...rest] = playerDeck;
    decks[playerId] = rest;
    return { meta: { ...meta, playerDecks: decks }, cardId };
  }

  private addCardsToPlayerDeck(
    meta: ZigEtZagMetadata,
    playerId: number,
    cards: string[],
  ): ZigEtZagMetadata {
    const decks = { ...meta.playerDecks };
    const playerDeck = Array.isArray(decks[playerId]) ? [...decks[playerId]] : [];
    decks[playerId] = [...playerDeck, ...cards];
    return { ...meta, playerDecks: decks };
  }

  private getMeta(state: GameStateEntity): ZigEtZagMetadata {
    return (state.metadata ?? {}) as ZigEtZagMetadata;
  }

  private setMeta(
    state: GameStateEntity,
    metadata: ZigEtZagMetadata,
  ): GameStateEntity {
    return { ...state, metadata };
  }

  private finishGame(state: GameStateEntity, winnerId: number): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta = { ...meta, winnerId };
    const finished = this.setMeta({ ...state, status: 'finished' }, nextMeta);
    return this.core.appendLog(
      finished,
      `${this.playerName(state.players, winnerId)} remporte Zig et Zag !`,
    );
  }

  private playerName(
    players: GameStateEntity['players'],
    playerId: number,
  ): string {
    const list = Array.isArray(players) ? players : [];
    const player = list.find((p) => p?.id === playerId);
    return player?.username?.trim() || `Joueur ${playerId}`;
  }

  private formatCardLabel(cardId: string): string {
    const def = ZIG_ET_ZAG_CARD_BY_ID[cardId];
    return def?.name ?? cardId;
  }
}
