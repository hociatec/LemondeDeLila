import { Injectable } from '@nestjs/common';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import type {
  VoyageCard,
  VoyageDeck,
  VoyageMetadata,
  VoyagePendingQuiz,
  VoyageTile,
  VoyageTileType,
} from '../model/voyage.types';

@Injectable()
export class VoyageActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
  ) {}

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim();
      if (type === 'roll' || type === 'ROLL_DICE' || type === 'roll_dice') {
        next = this.handleRoll(next);
        continue;
      }
      if (type === 'draw') {
        next = this.handleDraw(next);
        continue;
      }
      if (type === 'answer_quiz') {
        next = this.handleAnswerQuiz(next, action);
        continue;
      }
      if (type === 'choose_target') {
        next = this.handleChooseTarget(next, action);
      }
    }
    return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    if (state.pending) return state;

    const meta0 = this.getMeta(state);
    const rng = this.random.rollDice(meta0 as any, 6);
    const roll = rng.roll;
    let meta: VoyageMetadata = { ...meta0, ...rng.meta };

    let next: GameStateEntity = {
      ...state,
      lastRoll: roll,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };

    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} lance le dé : "${roll}".`,
    );

    // Déplacement (rebond sur la case finale)
    next = this.move(next, currentId, roll);
    next = this.applyLanding(next, currentId, { kind: 'none' });

    meta = this.getMeta(next);
    if (meta.winnerId != null) return { ...next, status: 'finished' };
    if (next.pending) return next;

    return this.advanceTurnWithCountdown(next);
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const pending = state.pending as any;
    if (!pending || pending.type !== 'draw') return state;
    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const deckType = String(pending?.data?.deck ?? '').trim() as VoyageTileType;
    let next: GameStateEntity = { ...state, pending: null };

    const meta0 = this.getMeta(next);
    const drawn = this.drawCard(meta0, deckType);
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...drawn.meta } };
    if (!drawn.card) {
      next = this.core.appendLog(next, 'Plus de cartes.');
      return this.advanceTurnWithCountdown(next);
    }

    next = this.core.appendLog(next, `Carte : ${drawn.card.title}.`);
    next = this.applyCard(next, playerId, deckType, drawn.card);

    const meta = this.getMeta(next);
    if (meta.winnerId != null) return { ...next, status: 'finished' };
    if (next.pending) return next;
    return this.advanceTurnWithCountdown(next);
  }

  private handleAnswerQuiz(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const pending = state.pending as any;
    if (!pending || pending.type !== 'quiz') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const meta0 = this.getMeta(state);
    const quiz = meta0.pendingQuiz;
    if (!quiz || quiz.playerId !== playerId) return state;

    const payload: any = action?.payload ?? {};
    const answerRaw =
      String(payload.answer ?? payload.choice ?? payload.value ?? '').trim();
    const choiceIndex =
      typeof payload.choiceIndex === 'number' && Number.isFinite(payload.choiceIndex)
        ? Math.trunc(payload.choiceIndex)
        : null;
    const choice =
      choiceIndex != null && Array.isArray(quiz.choices) && quiz.choices[choiceIndex]
        ? String(quiz.choices[choiceIndex]).trim()
        : answerRaw;
    const ok =
      quiz.answer != null
        ? normalize(choice) === normalize(quiz.answer)
        : false;

    let next: GameStateEntity = { ...state, pending: null };
    let meta: VoyageMetadata = {
      ...meta0,
      pendingQuiz: null,
    };

    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

    next = this.core.appendLog(next, ok ? 'Bonne réponse !' : 'Mauvaise réponse.');

    // Légende : si bonne réponse, on conserve la carte et on applique éventuellement un bonus.
    if (ok) {
      next = this.incrementCollection(next, playerId, 'legend');
      if (typeof (quiz as any).successDelta === 'number' && (quiz as any).successDelta !== 0) {
        const delta = Math.trunc((quiz as any).successDelta);
        next = this.core.appendLog(next, `Bonus : déplacement ${delta}.`);
        next = this.move(next, playerId, delta);
        next = this.applyLanding(next, playerId, { kind: 'none' });
      }
    } else {
      // Mauvaise réponse : la carte est défaussée.
      next = this.discardDrawnCard(next, 'legend', quiz.card, { keep: false });
    }

    meta = this.getMeta(next);
    if (meta.winnerId != null) return { ...next, status: 'finished' };
    return this.advanceTurnWithCountdown(next);
  }

  private handleChooseTarget(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_target') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const targetId = Number((action?.payload as any)?.targetPlayerId);
    if (!Number.isFinite(targetId)) return state;

    let next: GameStateEntity = { ...state, pending: null };
    const meta0 = this.getMeta(next);
    const kind = String(pending?.data?.kind ?? '').trim();
    const last = meta0.statuses?.lastTargetByActor?.[playerId] ?? null;
    if (last != null && last === targetId) {
      // Règle : aucun joueur ne peut être ciblé deux fois de suite par une même personne.
      next = this.core.appendLog(next, "Cible invalide : vous ne pouvez pas viser le même joueur deux fois de suite.");
      return { ...next, pending }; // on laisse le pending ouvert
    }
    if (kind === 'swap') {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} échange sa place avec ${this.playerName(next, targetId)}.`,
      );
      next = this.swapPositions(next, playerId, targetId);
      next = this.setLastTarget(next, playerId, targetId);
    }
    if (kind === 'skip1') {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, targetId)} perd son prochain tour.`,
      );
      next = this.addSkip(next, targetId, 1);
      next = this.setLastTarget(next, playerId, targetId);
    }
    if (kind === 'swap_card') {
      const count = Math.max(1, Math.trunc(Number(pending?.data?.count ?? 1)));
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} échange ${count} carte(s) avec ${this.playerName(next, targetId)}.`,
      );
      next = this.exchangeRandomCards(next, playerId, targetId, count);
      next = this.setLastTarget(next, playerId, targetId);
    }

    const meta = this.getMeta(next);
    if (meta.winnerId != null) return { ...next, status: 'finished' };
    return this.advanceTurnWithCountdown(next);
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
    context: { kind: 'none' | 'from_passage' },
  ): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const pos = meta.positions?.[playerId] ?? 0;
    const tile: VoyageTile | undefined = tiles[pos];
    if (!tile) return next;

    const label = tile.label?.trim()
      ? tile.label.trim()
      : tile.title?.trim()
        ? tile.title.trim()
        : `Case ${pos + 1}`;

    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} place son pion en case ${pos + 1} (${label}).`,
    );
    if (tile.description && String(tile.description).trim()) {
      next = this.core.appendLog(next, String(tile.description).trim());
    }

    if (tile.type === 'finish') {
      const metaNow = this.getMeta(next);
      if (metaNow.finishCountdown == null) {
        const players = Array.isArray(next.players) ? next.players : [];
        // On compte aussi le tour du joueur qui vient d'arriver, pour que tous les autres
        // joueurs puissent terminer le tour en cours et jouer une fois.
        const countdown = Math.max(0, players.length);
        const remainingTurns = Math.max(0, players.length - 1);
        const updated: VoyageMetadata = { ...metaNow, finishCountdown: countdown };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...updated } };
        next = this.core.appendLog(
          next,
          `Arrivée atteinte ! Les autres joueurs jouent encore ${remainingTurns} tour(s).`,
        );
      }
      return next;
    }

    if (tile.type === 'rest') {
      next = this.core.appendLog(next, 'Repos : vous passez votre prochain tour.');
      return this.addSkip(next, playerId, 1);
    }

    if (tile.type === 'passage') {
      if (context.kind === 'from_passage') return next;
      const otherPlayers = this.otherPlayers(next, playerId);
      if (/\béchange\b/i.test(tile.description ?? '') && otherPlayers.length) {
        const pending: PendingState = {
          type: 'choose_target',
          playerId,
          blocking: true,
          label: 'Choisir un joueur (échanger de place).',
          data: { kind: 'swap' },
          choices: otherPlayers.map((p) => p.username),
        };
        return { ...next, pending };
      }

      const delta = extractMoveDelta(tile.description ?? '');
      if (delta !== 0) {
        next = this.core.appendLog(next, `Passage : déplacement ${delta}.`);
        next = this.move(next, playerId, delta);
        return this.applyLanding(next, playerId, { kind: 'from_passage' });
      }
      return next;
    }

    if (tile.type === 'legend' || tile.type === 'farce' || tile.type === 'treasure' || tile.type === 'landscape') {
      const pending: PendingState = {
        type: 'draw',
        playerId,
        blocking: true,
        label: 'Piocher une carte (Espace).',
        data: { deck: tile.type },
      };
      return { ...next, pending };
    }

    return next;
  }

  private applyCard(
    state: GameStateEntity,
    playerId: number,
    deckType: VoyageTileType,
    card: VoyageCard,
  ): GameStateEntity {
    let next = state;

    if (deckType === 'legend') {
      const quiz = this.parseQuizCard(playerId, card);
      if (quiz) {
        const pending: PendingState = {
          type: 'quiz',
          playerId,
          blocking: true,
          label: 'Répondre au quiz.',
          question: quiz.question,
          choices: quiz.choices,
          data: { cardId: card.id },
        };
        const meta0 = this.getMeta(next);
        const meta: VoyageMetadata = { ...meta0, pendingQuiz: quiz };
        return {
          ...next,
          metadata: { ...(next.metadata ?? {}), ...meta },
          pending,
        };
      }
      // Pas un quiz : on conserve par défaut
      next = this.incrementCollection(next, playerId, 'legend');
      next = this.discardDrawnCard(next, 'legend', card, { keep: true });
      return this.applyGenericEffect(next, playerId, card.effect);
    }

    if (deckType === 'treasure') {
      next = this.incrementCollection(next, playerId, 'treasure');
      next = this.discardDrawnCard(next, 'treasure', card, { keep: true });
      return this.applyGenericEffect(next, playerId, card.effect);
    }

    if (deckType === 'landscape') {
      const keep = !/défauss/i.test(card.effect ?? '');
      if (keep) next = this.incrementCollection(next, playerId, 'landscape');
      next = this.discardDrawnCard(next, 'landscape', card, { keep });
      return this.applyGenericEffect(next, playerId, card.effect);
    }

    if (deckType === 'farce') {
      const keep = /gardez|conservez/i.test(card.effect ?? '');
      if (keep) next = this.incrementCollection(next, playerId, 'farce');
      next = this.discardDrawnCard(next, 'farce', card, { keep });
      return this.applyGenericEffect(next, playerId, card.effect);
    }

    return next;
  }

  private applyGenericEffect(
    state: GameStateEntity,
    playerId: number,
    textRaw: string,
  ): GameStateEntity {
    let next = state;
    const text = String(textRaw ?? '');

    // Effet ciblÃ© : choisir un joueur qui perd son prochain tour.
    if (
      /choisissez\s+un\s+joueur/i.test(text) &&
      /perd\s+son\s+prochain\s+tour/i.test(text)
    ) {
      const otherPlayers = this.otherPlayers(next, playerId);
      if (otherPlayers.length) {
        const pending: PendingState = {
          type: 'choose_target',
          playerId,
          blocking: true,
          label: 'Choisir un joueur (il perd son prochain tour).',
          data: { kind: 'skip1' },
          choices: otherPlayers.map((p) => p.username),
        };
        return { ...next, pending };
      }
    }

    // Effet : perdre une carte au hasard (simulation sur les compteurs).
    if (
      /tirez\s+au\s+hasard\s+une\s+carte/i.test(text) &&
      /vous\s+la\s+perdez/i.test(text)
    ) {
      const wantLegend = /l[ée]gende/i.test(text);
      const wantLandscape = /paysage/i.test(text);
      const wantTreasure = /tr[ée]sor/i.test(text);
      const wantFarce = /farce/i.test(text);
      next = this.loseRandomCard(next, playerId, {
        legend: wantLegend,
        landscape: wantLandscape,
        treasure: wantTreasure,
        farce: wantFarce,
      });
      return next;
    }
    const delta = extractMoveDelta(text);
    if (delta !== 0) {
      next = this.core.appendLog(next, `Effet : déplacement ${delta}.`);
      next = this.move(next, playerId, delta);
      return this.applyLanding(next, playerId, { kind: 'none' });
    }
    const skip = extractSkipTurns(text);
    if (skip > 0) {
      next = this.core.appendLog(next, `Effet : perdez ${skip} tour(s).`);
      return this.addSkip(next, playerId, skip);
    }

    // Échanges de cartes
    if (/échange/i.test(text) && /carte/i.test(text)) {
      const count = extractCardCount(text);

      // Cas "second joueur installé à la table" : on cible automatiquement.
      if (/second\s+joueur/i.test(text)) {
        const players = Array.isArray(next.players) ? next.players : [];
        const ids = players.map((p) => p?.id).filter((id): id is number => Number.isFinite(id as any));
        const targetId = ids.length >= 2 ? (ids[1] === playerId ? ids[0] : ids[1]) : null;
        if (targetId != null) {
          next = this.core.appendLog(next, `Échange automatique avec ${this.playerName(next, targetId)}.`);
          next = this.exchangeRandomCards(next, playerId, targetId, count);
          return this.setLastTarget(next, playerId, targetId);
        }
      }

      const otherPlayers = this.otherPlayers(next, playerId);
      if (otherPlayers.length) {
        const pending: PendingState = {
          type: 'choose_target',
          playerId,
          blocking: true,
          label: `Choisir un joueur (échanger ${count} carte(s)).`,
          data: { kind: 'swap_card', count },
          choices: otherPlayers.map((p) => p.username),
        };
        return { ...next, pending };
      }
    }

    // Échanges de position
    if (/échange/i.test(text) && /position/i.test(text)) {
      if (/dernier\s+joueur/i.test(text)) {
        const other = this.otherPlayers(next, playerId);
        if (other.length) {
          const meta = this.getMeta(next);
          const last = other
            .map((p) => p.id)
            .sort((a, b) => (meta.positions?.[a] ?? 0) - (meta.positions?.[b] ?? 0))[0];
          next = this.core.appendLog(
            next,
            `${this.playerName(next, playerId)} échange sa place avec ${this.playerName(next, last)}.`,
          );
          next = this.swapPositions(next, playerId, last);
          return this.setLastTarget(next, playerId, last);
        }
      }

      const otherPlayers = this.otherPlayers(next, playerId);
      if (otherPlayers.length) {
        const pending: PendingState = {
          type: 'choose_target',
          playerId,
          blocking: true,
          label: 'Choisir un joueur (échanger de place).',
          data: { kind: 'swap' },
          choices: otherPlayers.map((p) => p.username),
        };
        return { ...next, pending };
      }
    }

    return next;
  }

  private exchangeRandomCards(
    state: GameStateEntity,
    aId: number,
    bId: number,
    count: number,
  ): GameStateEntity {
    let next = state;
    for (let i = 0; i < count; i += 1) {
      const takeA = this.takeRandomCard(next, aId);
      next = takeA.state;
      const takeB = this.takeRandomCard(next, bId);
      next = takeB.state;

      if (takeA.kind) next = this.incrementCollection(next, bId, takeA.kind);
      if (takeB.kind) next = this.incrementCollection(next, aId, takeB.kind);
    }
    return next;
  }

  private takeRandomCard(
    state: GameStateEntity,
    playerId: number,
  ): { state: GameStateEntity; kind: 'legend' | 'farce' | 'treasure' | 'landscape' | null } {
    const meta = this.getMeta(state);
    const c = meta.collections?.[playerId] ?? { legend: 0, farce: 0, treasure: 0, landscape: 0 };
    const candidates: Array<'legend' | 'farce' | 'treasure' | 'landscape'> = [];
    if ((c.legend ?? 0) > 0) candidates.push('legend');
    if ((c.treasure ?? 0) > 0) candidates.push('treasure');
    if ((c.landscape ?? 0) > 0) candidates.push('landscape');
    if ((c.farce ?? 0) > 0) candidates.push('farce');
    if (!candidates.length) return { state, kind: null };

    const picked = this.random.pickOne(meta as any, candidates);
    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, ...(picked.meta as any) },
    };
    if (!picked.value) return { state: next, kind: null };
    next = this.decrementCollection(next, playerId, picked.value);
    return { state: next, kind: picked.value };
  }

  private parseQuizCard(playerId: number, card: VoyageCard): VoyagePendingQuiz | null {
    const effect = String(card.effect ?? '');
    const choiceLines = effect
      .split(/\s*(?=[*]?[ABC]\))/i)
      .map((s) => s.trim())
      .filter((s) => /^[*]?[ABC]\)/i.test(s));
    if (!choiceLines.length) return null;

    const qMatch = effect.match(/question\s*:\s*([^?]+\?)/i);
    const question = (qMatch?.[1] ?? card.title ?? 'Quiz').trim();
    const choices = choiceLines.map((l) => l.replace(/^[*]?[ABC]\)\s*/i, '').trim());
    const answerLine = choiceLines.find((l) => l.trim().startsWith('*')) ?? '';
    const answer = answerLine ? answerLine.replace(/^[*]?[ABC]\)\s*/i, '').trim() : undefined;
    const successDelta = extractMoveDelta(effect);
    return {
      playerId,
      cardId: card.id,
      card,
      question,
      choices,
      answer,
      ...(successDelta ? ({ successDelta } as any) : {}),
    };
  }

  private drawCard(
    meta: VoyageMetadata,
    deckType: VoyageTileType,
  ): { card: VoyageCard | null; meta: VoyageMetadata } {
    const deckId =
      deckType === 'legend'
        ? 'legend'
        : deckType === 'farce'
          ? 'farce'
          : deckType === 'treasure'
            ? 'treasure'
            : 'landscape';

    const deck: VoyageDeck = (meta.decks as any)?.[deckId] ?? { cards: [], discard: [] };
    const cards = Array.isArray(deck.cards) ? deck.cards : [];
    const discard = Array.isArray(deck.discard) ? deck.discard : [];

    if (!cards.length && discard.length) {
      const shuffled = this.random.shuffle(meta as any, discard);
      const reshuffled: VoyageMetadata = {
        ...meta,
        ...shuffled.meta,
        decks: { ...meta.decks, [deckId]: { cards: shuffled.values as any, discard: [] } } as any,
      };
      return this.drawCard(reshuffled, deckType);
    }
    if (!cards.length) return { card: null, meta };
    const [card, ...rest] = cards;
    // IMPORTANT: on ne met pas automatiquement en défausse. Le sort de la carte dépend du type (conservée ou non).
    const nextMeta: VoyageMetadata = {
      ...meta,
      decks: {
        ...meta.decks,
        [deckId]: { cards: rest, discard },
      } as any,
    };
    return { card, meta: nextMeta };
  }

  private discardDrawnCard(
    state: GameStateEntity,
    deckType: 'legend' | 'farce' | 'treasure' | 'landscape',
    card: VoyageCard,
    options: { keep: boolean },
  ): GameStateEntity {
    if (options.keep) {
      // Carte conservée : elle sort du circuit (pas remise en défausse).
      return state;
    }
    const meta = this.getMeta(state);
    const deck = (meta.decks as any)?.[deckType] as VoyageDeck | undefined;
    const discard = Array.isArray(deck?.discard) ? deck!.discard : [];
    const nextMeta: VoyageMetadata = {
      ...meta,
      decks: {
        ...meta.decks,
        [deckType]: {
          cards: Array.isArray(deck?.cards) ? deck!.cards : [],
          discard: [...discard, card],
        },
      } as any,
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private move(state: GameStateEntity, playerId: number, delta: number): GameStateEntity {
    const meta = this.getMeta(state);
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const max = Math.max(0, tiles.length - 1);
    const pos = meta.positions?.[playerId] ?? 0;
    const nextPos = bounce(pos + delta, max);
    const nextMeta: VoyageMetadata = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: nextPos },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private swapPositions(state: GameStateEntity, a: number, b: number): GameStateEntity {
    const meta = this.getMeta(state);
    const posA = meta.positions?.[a] ?? 0;
    const posB = meta.positions?.[b] ?? 0;
    const nextMeta: VoyageMetadata = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [a]: posB, [b]: posA },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private addSkip(state: GameStateEntity, playerId: number, turns: number): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.statuses?.skipTurn?.[playerId] ?? 0;
    const nextMeta: VoyageMetadata = {
      ...meta,
      statuses: {
        ...meta.statuses,
        skipTurn: { ...(meta.statuses.skipTurn ?? {}), [playerId]: current + turns },
      },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private incrementCollection(
    state: GameStateEntity,
    playerId: number,
    kind: 'legend' | 'farce' | 'treasure' | 'landscape',
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.collections?.[playerId] ?? {
      legend: 0,
      farce: 0,
      treasure: 0,
      landscape: 0,
    };
    const nextCollections = {
      ...(meta.collections ?? {}),
      [playerId]: { ...current, [kind]: (current as any)[kind] + 1 },
    };
    const nextMeta: VoyageMetadata = { ...meta, collections: nextCollections };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private decrementCollection(
    state: GameStateEntity,
    playerId: number,
    kind: 'legend' | 'farce' | 'treasure' | 'landscape',
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.collections?.[playerId] ?? {
      legend: 0,
      farce: 0,
      treasure: 0,
      landscape: 0,
    };
    const nextVal = Math.max(0, (current as any)[kind] - 1);
    const nextCollections = {
      ...(meta.collections ?? {}),
      [playerId]: { ...current, [kind]: nextVal },
    };
    const nextMeta: VoyageMetadata = { ...meta, collections: nextCollections };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private loseRandomCard(
    state: GameStateEntity,
    playerId: number,
    filter: {
      legend?: boolean;
      farce?: boolean;
      treasure?: boolean;
      landscape?: boolean;
    },
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const c = meta.collections?.[playerId] ?? {
      legend: 0,
      farce: 0,
      treasure: 0,
      landscape: 0,
    };
    const candidates: Array<'legend' | 'farce' | 'treasure' | 'landscape'> = [];
    const allow = (k: keyof typeof c) => filter[k] !== false;

    if (allow('legend') && (c.legend ?? 0) > 0) candidates.push('legend');
    if (allow('landscape') && (c.landscape ?? 0) > 0) candidates.push('landscape');
    if (allow('treasure') && (c.treasure ?? 0) > 0) candidates.push('treasure');
    if (allow('farce') && (c.farce ?? 0) > 0) candidates.push('farce');

    if (!candidates.length) {
      return this.core.appendLog(state, 'Aucune carte Ã  perdre.');
    }

    const picked = this.random.pickOne(meta as any, candidates);
    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, ...(picked.meta as any) },
    };
    if (!picked.value) return next;
    next = this.core.appendLog(next, `Vous perdez une carte (${picked.value}).`);
    return this.decrementCollection(next, playerId, picked.value);
  }

  private advanceTurnWithCountdown(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    if (meta.finishCountdown == null) return this.turns.advanceTurn(state);
    const remaining = Number(meta.finishCountdown);
    const nextRemaining = Math.max(0, remaining - 1);
    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, finishCountdown: nextRemaining },
    };
    next = this.turns.advanceTurn(next);
    if (nextRemaining <= 0) {
      return this.finishByScore(next);
    }
    return next;
  }

  private finishByScore(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const players = Array.isArray(state.players) ? state.players : [];
    const score = (id: number) => {
      const c = meta.collections?.[id] ?? { legend: 0, farce: 0, treasure: 0, landscape: 0 };
      const total = (c.legend ?? 0) + (c.farce ?? 0) + (c.treasure ?? 0) + (c.landscape ?? 0);
      return { total, legend: c.legend ?? 0 };
    };
    const ranked = players
      .map((p) => ({ id: p.id, ...score(p.id) }))
      .sort((a, b) => (b.total - a.total) || (b.legend - a.legend) || (a.id - b.id));
    const winnerId = ranked[0]?.id ?? null;
    const nextMeta: VoyageMetadata = { ...meta, winnerId };
    let next: GameStateEntity = {
      ...state,
      status: 'finished',
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
    if (winnerId != null) {
      next = this.core.appendLog(next, `${this.playerName(next, winnerId)} remporte la partie !`);
    }
    return next;
  }

  private otherPlayers(
    state: GameStateEntity,
    me: number,
  ): Array<{ id: number; username: string }> {
    const players = Array.isArray(state.players) ? state.players : [];
    return players
      .filter((p) => p?.id != null && p.id !== me)
      .map((p) => ({ id: p.id, username: this.playerName(state, p.id) }));
  }

  private getMeta(state: GameStateEntity): VoyageMetadata {
    return (state.metadata ?? {}) as any as VoyageMetadata;
  }

  private setLastTarget(state: GameStateEntity, actorId: number, targetId: number): GameStateEntity {
    const meta = this.getMeta(state);
    const last = meta.statuses?.lastTargetByActor ?? {};
    const nextMeta: VoyageMetadata = {
      ...meta,
      statuses: {
        ...meta.statuses,
        lastTargetByActor: { ...(last ?? {}), [actorId]: targetId },
      },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private playerName(state: GameStateEntity, id: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const p = players.find((x) => x?.id === id);
    const u =
      p?.username && String(p.username).trim()
        ? String(p.username).trim()
        : null;
    return u ?? `Joueur ${id}`;
  }
}

function bounce(target: number, max: number): number {
  if (max <= 0) return 0;
  if (target < 0) return 0;
  if (target === max) return max;
  if (target < max) return target;
  const over = target - max;
  return max - over;
}

function normalize(value: string): string {
  return String(value ?? '').trim().toLowerCase();
}

function extractMoveDelta(text: string): number {
  const parse = (raw: string) => {
    const v = raw.trim().toLowerCase();
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    const map: Record<string, number> = {
      un: 1,
      une: 1,
      deux: 2,
      trois: 3,
      quatre: 4,
      cinq: 5,
      six: 6,
    };
    return map[v] ?? 0;
  };
  const forward = text.match(
    /avance(?:z)?\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (forward) return parse(forward[1]);
  const backward = text.match(
    /recule(?:z)?\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (backward) return -parse(backward[1]);
  return 0;
}

function extractSkipTurns(text: string): number {
  if (/Passez trois tours/i.test(text)) return 3;
  if (/Passez deux tours/i.test(text)) return 2;
  if (/Passez votre tour/i.test(text) || /Passe ton prochain tour/i.test(text)) return 1;
  return 0;
}

function extractCardCount(text: string): number {
  if (/\b2\b/.test(text) || /\bdeux\b/i.test(text)) return 2;
  if (/\b3\b/.test(text) || /\btrois\b/i.test(text)) return 3;
  return 1;
}
