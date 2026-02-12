import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import type {
  ZigEtZagMetadata,
  ZigEtZagRoundState,
  ZigEtZagRoundSummary,
} from '../model/zig-et-zag-state.entity';
import { ZIG_ET_ZAG_CARD_BY_ID, ZIG_ET_ZAG_TOTAL_CARDS } from '../model/zig-et-zag-cards';
import {
  buildInitialRoundState,
  getPlayerHand,
  getPlayerHandSize,
  playerHasCard,
  removeCardFromHand,
  isCardAllowed,
} from '../round-state.helper';

@Injectable()
export class ZigEtZagActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
    private readonly random: RandomService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim().toLowerCase();
      if (type === 'select_card') {
        next = this.handleSelectCard(next, action);
        continue;
      }
      if (type === 'draw_card') {
        next = this.handleDrawCard(next, action);
        continue;
      }
    }
    return next;
  }

  private handleSelectCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const actorId = this.getActorId(action, state);
    if (actorId == null) {
      return state;
    }
    const cardId = String((action.payload as any)?.cardId ?? '').trim();
    if (!cardId) {
      return state;
    }
    if (String(state.status ?? '').toLowerCase() !== 'started') {
      return state;
    }

    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) {
      return state;
    }

    const ensured = this.ensureRoundState(state, players);
    state = ensured.state;
    const meta = this.getMeta(state);
    const round = ensured.round;
    if (!round || !this.isWaitingPlayer(round, actorId)) {
      return state;
    }
    if (!playerHasCard(meta, actorId, cardId)) {
      return state;
    }
    if (!isCardAllowed(round, actorId, cardId)) {
      return state;
    }

    return this.playCardWithId(state, players, meta, round, actorId, cardId);
  }

  private handleDrawCard(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const actorId = this.getActorId(action, state);
    if (actorId == null) {
      return state;
    }
    if (String(state.status ?? '').toLowerCase() !== 'started') {
      return state;
    }

    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) {
      return state;
    }

    const ensured = this.ensureRoundState(state, players);
    state = ensured.state;
    const meta = this.getMeta(state);
    const round = ensured.round;
    if (!round || !this.isWaitingPlayer(round, actorId)) {
      return state;
    }

    const hand = getPlayerHand(meta, actorId);
    if (!hand.length) {
      return state;
    }

    const rngMeta = meta.rng ?? {};
    const { index, meta: nextRng } = this.random.pickIndex(rngMeta, hand.length);
    const cardId = hand[index];
    if (!cardId) {
      return state;
    }
    const metaWithRng = { ...meta, rng: nextRng };
    const withDrawLog = this.core.appendLog(
      state,
      `${this.playerName(players, actorId)} pioche.`,
    );

    return this.playCardWithId(
      withDrawLog,
      players,
      metaWithRng,
      round,
      actorId,
      cardId,
    );
  }

  private finalizeStage(
    state: GameStateEntity,
    players: GameStateEntity['players'],
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const round = meta.roundState;
    if (!round) {
      return state;
    }
    switch (round.stage) {
      case 'selection':
        return this.handleSelectionCompletion(state, players, round);
      case 'battle_face_down':
        return this.promoteToBattleFaceUp(state, players, round);
      case 'battle_face_up':
        return this.resolveBattle(state, players, round);
      default:
        return state;
    }
  }

  private handleSelectionCompletion(
    state: GameStateEntity,
    players: GameStateEntity['players'],
    round: ZigEtZagRoundState,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    let nextState = this.appendCollectiveRevealLog(state, players, round);
    nextState = this.appendRevealLogs(nextState, players, round);
    if (this.hasSelectionJoker(round)) {
      nextState = this.core.appendLog(
        nextState,
        'Joker joué hors bataille : les cartes sont défaussées.',
      );
      return this.finishRound(nextState, players, round, null);
    }

    const evaluation = this.evaluateFaceUpPlays(round);
    if (evaluation.tiePlayers.length > 1) {
      const nextRound = this.prepareBattle(round, evaluation.tiePlayers, meta);
      nextState = this.core.appendLog(nextState, 'Bataille déclenchée !');
      if (!nextRound.waitingPlayers.length) {
        return this.finishRound(
          nextState,
          players,
          nextRound,
          nextRound.tiedPlayers[0] ?? null,
        );
      }
      return this.setRoundState(nextState, meta, nextRound);
    }
    return this.finishRound(nextState, players, round, evaluation.winnerId);
  }

  private prepareBattle(
    round: ZigEtZagRoundState,
    tiedPlayers: number[],
    metadata: ZigEtZagMetadata,
  ): ZigEtZagRoundState {
    const plays = round.plays.map((play) => ({ ...play }));
    const waitingPlayers: number[] = [];
    const triggerColors = { ...round.triggerColors };
    const triggerFamilies = { ...round.triggerFamilies };

    tiedPlayers.forEach((playerId) => {
      const entry = plays.find((play) => play.playerId === playerId);
      if (entry?.faceUpCard) {
        const def = ZIG_ET_ZAG_CARD_BY_ID[entry.faceUpCard];
        if (def) {
          triggerColors[playerId] = def.color;
          triggerFamilies[playerId] = def.family;
        }
      }
      if (getPlayerHandSize(metadata, playerId) > 0) {
        waitingPlayers.push(playerId);
      } else if (entry) {
        entry.lostByNoCard = true;
      }
    });

    return {
      ...round,
      stage: 'battle_face_down',
      plays,
      waitingPlayers,
      tiedPlayers: waitingPlayers,
      triggerColors,
      triggerFamilies,
      battleLog: [
        ...round.battleLog,
        'Bataille déclenchée !',
      ],
    };
  }

  private promoteToBattleFaceUp(
    state: GameStateEntity,
    players: GameStateEntity['players'],
    round: ZigEtZagRoundState,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const plays = round.plays.map((play) => ({ ...play }));
    const battleLog = [...round.battleLog];
    const waitingPlayers: number[] = [];
    let nextState = state;

    round.tiedPlayers.forEach((playerId) => {
      if (getPlayerHandSize(meta, playerId) <= 0) {
        const entry = plays.find((play) => play.playerId === playerId);
        if (entry) {
          entry.lostByNoCard = true;
        }
        const message = `${this.playerName(players, playerId)} n'a plus de cartes.`;
        battleLog.push(message);
        nextState = this.core.appendLog(nextState, message);
        return;
      }
      waitingPlayers.push(playerId);
    });

    if (!waitingPlayers.length) {
      return this.finishRound(nextState, players, { ...round, plays }, null);
    }

    if (waitingPlayers.length === 1) {
      return this.finishRound(
        nextState,
        players,
        { ...round, plays },
        waitingPlayers[0],
      );
    }

    const nextRound: ZigEtZagRoundState = {
      ...round,
      stage: 'battle_face_up',
      plays,
      waitingPlayers,
      tiedPlayers: waitingPlayers,
      battleLog,
    };

    return this.setRoundState(nextState, meta, nextRound);
  }

  private resolveBattle(
    state: GameStateEntity,
    players: GameStateEntity['players'],
    round: ZigEtZagRoundState,
  ): GameStateEntity {
    let nextState = this.appendCollectiveRevealLog(
      state,
      players,
      round,
      round.tiedPlayers,
    );
    nextState = this.appendRevealLogs(nextState, players, round, round.tiedPlayers);
    const meta = this.getMeta(state);
    const faceUpPlays = round.plays.filter(
      (play) =>
        round.tiedPlayers.includes(play.playerId) &&
        !play.lostByNoCard &&
        play.faceUpCard &&
        !play.invalidJoker,
    );
    const results = faceUpPlays
      .map((play) => {
        const def = ZIG_ET_ZAG_CARD_BY_ID[play.faceUpCard!];
        return def
          ? { playerId: play.playerId, value: def.value, color: def.color, family: def.family }
          : { playerId: play.playerId, value: -1 };
      })
      .filter((entry) => entry.value >= 0);

    if (!results.length) {
      nextState = this.core.appendLog(
        nextState,
        'Aucune carte valide : les cartes sont défaussées.',
      );
      return this.finishRound(nextState, players, round, null);
    }

    const maxValue = Math.max(...results.map((entry) => entry.value));
    const winners = results
      .filter((entry) => entry.value === maxValue)
      .map((entry) => entry.playerId);

    if (winners.length === 1) {
      return this.finishRound(nextState, players, round, winners[0]);
    }

    const triggerColors = { ...round.triggerColors };
    const triggerFamilies = { ...round.triggerFamilies };
    results.forEach((entry) => {
      if (entry.color) {
        triggerColors[entry.playerId] = entry.color;
        triggerFamilies[entry.playerId] = entry.family;
      }
    });

    const waitingPlayers = winners.filter((playerId) =>
      getPlayerHandSize(meta, playerId) > 0,
    );

    if (!waitingPlayers.length) {
      return this.finishRound(
        nextState,
        players,
        round,
        winners[0] ?? null,
      );
    }

    const nextRound: ZigEtZagRoundState = {
      ...round,
      stage: 'battle_face_down',
      tiedPlayers: winners,
      waitingPlayers,
      triggerColors,
      triggerFamilies,
      battleLog: [
        ...round.battleLog,
        'Égalité persistante, la bataille continue !',
      ],
    };

    nextState = this.core.appendLog(
      nextState,
      'Égalité persistante, la bataille continue !',
    );
    return this.setRoundState(nextState, meta, nextRound);
  }

  private finishRound(
    state: GameStateEntity,
    players: GameStateEntity['players'],
    round: ZigEtZagRoundState,
    winnerId: number | null,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const cards = this.collectTableCards(round.plays);
    const summary: ZigEtZagRoundSummary = {
      winnerId,
      cardsWon: cards.length,
      plays: round.plays,
      battleLog: round.battleLog,
    };
    const nextMeta = this.addCardsToWinner(meta, winnerId, cards);
    let nextState: GameStateEntity = {
      ...state,
      metadata: {
        ...nextMeta,
        roundState: null,
        lastRound: summary,
      },
    };

    const finalWinner = this.detectWinner(nextMeta, players);
    if (finalWinner != null) {
      nextState = this.core.appendLog(
        { ...nextState, status: 'finished' },
        `${this.playerName(players, finalWinner)} remporte Zig et Zag !`,
      );
      nextState = {
        ...nextState,
        metadata: {
          ...(nextState.metadata ?? {}),
          winnerId: finalWinner,
        },
      } as GameStateEntity;
    } else {
      nextState = this.turns.advanceTurn(nextState);
      // Ensure a round state exists right away so bot selection can be scheduled deterministically.
      const ensured = this.ensureRoundState(nextState, players);
      nextState = this.setCurrentPlayer(
        ensured.state,
        this.pickNextCurrentPlayerId(
          ensured.round,
          ensured.state.turn?.currentPlayerId ?? 0,
        ),
      );
    }

    return this.logRound(nextState, summary, players);
  }

  private logRound(
    state: GameStateEntity,
    summary: ZigEtZagRoundSummary,
    players: GameStateEntity['players'],
  ): GameStateEntity {
    let next = state;
    if (summary.winnerId != null && summary.cardsWon > 0) {
      next = this.core.appendLog(
        next,
        `${this.playerName(players, summary.winnerId)} remporte ${summary.cardsWon} cartes.`,
      );
    }

    return next;
  }

  private appendRevealLogs(
    state: GameStateEntity,
    players: GameStateEntity['players'],
    round: ZigEtZagRoundState,
    onlyPlayers?: number[],
  ): GameStateEntity {
    let next = state;
    const filter = Array.isArray(onlyPlayers) && onlyPlayers.length
      ? new Set(onlyPlayers)
      : null;

    for (const play of round.plays ?? []) {
      if (filter && !filter.has(play.playerId)) continue;
      if (round.stage === 'selection' && play.lostByNoCard) {
        next = this.core.appendLog(
          next,
          `${this.playerName(players, play.playerId)} n'a plus de cartes.`,
        );
        continue;
      }
      if (play.faceUpCard) {
        next = this.core.appendLog(
          next,
          `${this.playerName(players, play.playerId)} dévoile ${this.formatCardLabel(play.faceUpCard)}.`,
        );
      }
    }

    return next;
  }

  private appendCollectiveRevealLog(
    state: GameStateEntity,
    players: GameStateEntity['players'],
    round: ZigEtZagRoundState,
    onlyPlayers?: number[],
  ): GameStateEntity {
    const filter = Array.isArray(onlyPlayers) && onlyPlayers.length
      ? new Set(onlyPlayers)
      : null;
    const revealPlayers = (round.plays ?? [])
      .filter((play) => {
        if (filter && !filter.has(play.playerId)) return false;
        return Boolean(play.faceUpCard);
      })
      .map((play) => this.playerName(players, play.playerId));

    if (revealPlayers.length <= 1) {
      return state;
    }

    const summary =
      revealPlayers.length === 2
        ? `${revealPlayers[0]} et ${revealPlayers[1]} devoilent leurs cartes.`
        : `${revealPlayers.slice(0, -1).join(', ')} et ${revealPlayers[revealPlayers.length - 1]} devoilent leurs cartes.`;
    return this.core.appendLog(state, summary);
  }

  private hasSelectionJoker(round: ZigEtZagRoundState): boolean {
    return (round.plays ?? []).some((play) => {
      if (!play.faceUpCard) return false;
      const def = ZIG_ET_ZAG_CARD_BY_ID[play.faceUpCard];
      return def?.type === 'joker';
    });
  }

  private setCurrentPlayer(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    return {
      ...state,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: playerId,
        direction: 1,
      },
    };
  }

  private setRoundState(
    state: GameStateEntity,
    metadata: ZigEtZagMetadata,
    round: ZigEtZagRoundState | null,
  ): GameStateEntity {
    return {
      ...state,
      metadata: {
        ...metadata,
        roundState: round,
      },
    };
  }

  private getMeta(state: GameStateEntity): ZigEtZagMetadata {
    return (state.metadata ?? {}) as ZigEtZagMetadata;
  }

  private ensureRoundState(
    state: GameStateEntity,
    players: GameStateEntity['players'],
  ): { state: GameStateEntity; round: ZigEtZagRoundState } {
    const meta = this.getMeta(state);
    if (meta.roundState) {
      const normalized = this.normalizeRoundState(meta.roundState);
      const nextState = this.setRoundState(state, meta, normalized);
      return { state: nextState, round: normalized };
    }
    const safePlayers = Array.isArray(players) ? players : [];
    const round = buildInitialRoundState(meta, safePlayers);
    const normalized = this.normalizeRoundState(round);
    const nextState = this.setRoundState(state, meta, normalized);
    return { state: nextState, round: normalized };
  }

  private normalizeRoundState(round: ZigEtZagRoundState): ZigEtZagRoundState {
    const asNumberOrNull = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const n = Number(value.trim());
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };

    const normalizeIdList = (list: unknown): number[] => {
      const arr = Array.isArray(list) ? list : [];
      return arr
        .map((v) => asNumberOrNull(v))
        .filter((v): v is number => typeof v === 'number');
    };

    const plays = Array.isArray(round?.plays) ? round.plays : [];
    const normalizedPlays = plays
      .map((play: any) => {
        const pid = asNumberOrNull(play?.playerId);
        if (pid == null) return null;
        return {
          ...play,
          playerId: pid,
          playedCards: Array.isArray(play?.playedCards) ? play.playedCards : [],
        } as any;
      })
      .filter((p): p is ZigEtZagRoundState['plays'][number] => Boolean(p));

    return {
      ...round,
      plays: normalizedPlays,
      waitingPlayers: normalizeIdList((round as any)?.waitingPlayers),
      tiedPlayers: normalizeIdList((round as any)?.tiedPlayers),
    };
  }

  private pickNextCurrentPlayerId(
    round: ZigEtZagRoundState,
    fallback: number,
  ): number {
    const waiting = Array.isArray(round?.waitingPlayers) ? round.waitingPlayers : [];
    if (!waiting.length) return fallback;
    return waiting[0] ?? fallback;
  }

  private recordPlayedCard(
    round: ZigEtZagRoundState,
    playerId: number,
    cardId: string,
  ): ZigEtZagRoundState {
    const plays = round.plays.map((play) =>
      play.playerId === playerId ? { ...play } : play,
    );
    const entry = plays.find((play) => play.playerId === playerId);
    if (!entry) {
      return round;
    }
    entry.playedCards = [...entry.playedCards, cardId];

    if (round.stage === 'battle_face_down') {
      entry.faceDownCard = cardId;
    } else {
      entry.faceUpCard = cardId;
      entry.invalidJoker =
        round.stage !== 'selection' && !isCardAllowed(round, playerId, cardId);
    }

    return {
      ...round,
      plays,
    };
  }

  private playCardWithId(
    state: GameStateEntity,
    players: GameStateEntity['players'],
    meta: ZigEtZagMetadata,
    round: ZigEtZagRoundState,
    playerId: number,
    cardId: string,
  ): GameStateEntity {
    const { metadata: drainedMeta, removed } = removeCardFromHand(
      meta,
      playerId,
      cardId,
    );
    if (!removed) {
      return state;
    }

    const nextRound = this.recordPlayedCard(round, playerId, cardId);
    nextRound.waitingPlayers = this.normalizeWaitingPlayers(nextRound).filter(
      (pid) => pid !== playerId,
    );

    let nextState = this.setRoundState(state, drainedMeta, nextRound);
    nextState = this.setCurrentPlayer(
      nextState,
      this.pickNextCurrentPlayerId(nextRound, playerId),
    );

    if (!nextRound.waitingPlayers.length) {
      nextState = this.finalizeStage(nextState, players);
    }

    return nextState;
  }

  private isWaitingPlayer(
    round: ZigEtZagRoundState,
    playerId: number,
  ): boolean {
    const waiting = this.normalizeWaitingPlayers(round);
    return waiting.length > 0 && waiting[0] === playerId;
  }

  private normalizeWaitingPlayers(round: ZigEtZagRoundState): number[] {
    return (round.waitingPlayers ?? [])
      .map((value: any) => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
          const n = Number(value.trim());
          return Number.isFinite(n) ? n : null;
        }
        return null;
      })
      .filter((value): value is number => typeof value === 'number');
  }

  private collectTableCards(plays: ZigEtZagRoundState['plays']): string[] {
    return plays.flatMap((play) => play.playedCards);
  }

  private evaluateFaceUpPlays(round: ZigEtZagRoundState): {
    winnerId: number | null;
    tiePlayers: number[];
  } {
    const faceUpResults = round.plays
      .filter((play) => play.faceUpCard && !play.lostByNoCard)
      .map((play) => {
        const def = ZIG_ET_ZAG_CARD_BY_ID[play.faceUpCard!];
        return def ? { playerId: play.playerId, value: def.value } : null;
      })
      .filter((entry): entry is { playerId: number; value: number } => Boolean(entry));

    if (!faceUpResults.length) {
      return { winnerId: null, tiePlayers: [] };
    }

    const maxValue = Math.max(...faceUpResults.map((entry) => entry.value));
    const winners = faceUpResults
      .filter((entry) => entry.value === maxValue)
      .map((entry) => entry.playerId);

    return {
      winnerId: winners.length === 1 ? winners[0] : null,
      tiePlayers: winners,
    };
  }

  private addCardsToWinner(
    metadata: ZigEtZagMetadata,
    winnerId: number | null,
    cards: string[],
  ): ZigEtZagMetadata {
    if (winnerId == null) {
      return metadata;
    }
    const decks = { ...(metadata.playerDecks ?? {}) };
    const hand = Array.isArray(decks[winnerId]) ? [...decks[winnerId]] : [];
    decks[winnerId] = [...hand, ...cards];
    return {
      ...metadata,
      playerDecks: decks,
    };
  }

  private detectWinner(
    metadata: ZigEtZagMetadata,
    players: GameStateEntity['players'],
  ): number | null {
    const playerIds = (players ?? [])
      .map((player) => player?.id)
      .filter((id): id is number => typeof id === 'number');
    const alive = playerIds.filter(
      (playerId) => (metadata.playerDecks[playerId]?.length ?? 0) > 0,
    );
    if (alive.length === 1) {
      return alive[0];
    }
    const ownerOfAll = playerIds.find(
      (playerId) =>
        (metadata.playerDecks[playerId]?.length ?? 0) === ZIG_ET_ZAG_TOTAL_CARDS,
    );
    return ownerOfAll ?? null;
  }

  private playerName(
    players: GameStateEntity['players'],
    playerId: number,
  ): string {
    const list = Array.isArray(players) ? players : [];
    return list.find((player) => player?.id === playerId)?.username?.trim() ||
      `Joueur ${playerId}`;
  }

  private formatCardLabel(cardId: string): string {
    return ZIG_ET_ZAG_CARD_BY_ID[cardId]?.name ?? cardId;
  }

  private getActorId(
    action: GameSingleActionDto,
    state: GameStateEntity,
  ): number | null {
    const actorFromMeta = (action.meta as any)?.actorId;
    if (typeof actorFromMeta === 'number') {
      return actorFromMeta;
    }
    return state.turn?.currentPlayerId ?? null;
  }
}
