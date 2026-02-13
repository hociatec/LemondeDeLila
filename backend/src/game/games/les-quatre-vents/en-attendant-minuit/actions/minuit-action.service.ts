import { Injectable } from '@nestjs/common';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { MINUIT_GAME } from '../definitions/minuit.definition';
import type {
  MinuitCard,
  MinuitMetadata,
  MinuitPendingQuiz,
  MinuitTile,
} from '../model/minuit.types';

const MINUIT_PAWNS = [
  'Le Lutin',
  'Le Bonhomme de Neige',
  'La Fée des Flocons',
  'Le Père Noël',
  'Le Renne',
  "Le Petit Bonhomme en Pain d'Épices",
];

@Injectable()
export class MinuitActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = this.ensurePawnSelection(state);
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim();
      if (type === 'pick_pawn') {
        next = this.handlePickPawn(next, action);
        next = this.ensurePawnSelection(next);
        continue;
      }
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

  private isBotLike(player: any): boolean {
    if (!player) return false;
    if (player.isBot === true) return true;
    const username = String(player?.username ?? '').toLowerCase();
    return username.includes('bot');
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const meta0 = this.getMeta(state);
    if (meta0.pendingQuiz || state.pending) return state;

    let meta = meta0;

    // "Piochez à nouveau une carte au lieu de lancer le dé" (tour suivant).
    if (meta.statuses?.forceDrawNextTurn?.[currentId] === true) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          forceDrawNextTurn: {
            ...(meta.statuses.forceDrawNextTurn ?? {}),
            [currentId]: false,
          },
        },
      };

      let next: GameStateEntity = {
        ...state,
        lastRoll: 0,
        metadata: { ...(state.metadata ?? {}), ...meta },
      };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} pioche une carte au lieu de lancer le dé.`,
      );
      return {
        ...next,
        pending: {
          type: 'draw',
          playerId: currentId,
          blocking: true,
          label: 'Piocher une carte Noël (Espace).',
          data: { context: 'force_draw' },
        },
      };
    }

    const rng = this.random.rollDice(meta as any, 6);
    meta = { ...meta, ...rng.meta };
    const roll = rng.roll;

    let next: GameStateEntity = {
      ...state,
      lastRoll: roll,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };
    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} lance le dé : "${roll}".`,
    );

    next = this.move(next, currentId, roll);
    next = this.applyLanding(next, currentId);

    meta = this.getMeta(next);
    if (meta.winnerId != null) return { ...next, status: 'finished' };
    if (meta.pendingQuiz || next.pending) return next;
    return this.advanceTurnOrKeep(next, currentId);
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const pending = state.pending as any;
    if (!pending || pending.type !== 'draw') return state;

    const currentId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    let next: GameStateEntity = { ...state, pending: null };
    next = this.applyDrawCard(next, currentId);

    const meta = this.getMeta(next);
    if (meta.winnerId != null) return { ...next, status: 'finished' };
    if (meta.pendingQuiz || next.pending) return next;
    return this.advanceTurnOrKeep(next, currentId);
  }

  private applyDrawCard(state: GameStateEntity, playerId: number): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const draw = this.drawCard(meta);
    meta = draw.meta;
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    if (!draw.card) return next;
    const effectText = this.formatCardEffect(draw.card);
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} pioche "${draw.card.title}".`,
    );
    if (effectText) {
      next = this.core.appendLog(next, effectText);
    }
    return this.applyCard(next, playerId, draw.card);
  }

  private handleAnswerQuiz(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    let meta = this.getMeta(state);
    const pending = meta.pendingQuiz ?? null;
    if (!pending || pending.playerId !== currentId) return state;

    const answer = String((action.payload as any)?.answer ?? '').trim();
    const correct =
      pending.anyCorrect === true
        ? true
        : (pending.answer ?? '').trim().toLowerCase() === answer.toLowerCase();

    let next: GameStateEntity = state;
    const who = this.playerName(next, currentId);
    if (correct) {
      const delta =
        typeof pending.successDelta === 'number' ? pending.successDelta : 0;
      next = this.core.appendLog(
        next,
        `${who} répond. Bonne réponse.`,
      );
      if (delta > 0) {
        next = this.move(next, currentId, delta);
      }
    } else {
      next = this.core.appendLog(
        next,
        `${who} répond. Mauvaise réponse.`,
      );
      const failDelta =
        typeof pending.failureDelta === 'number' ? pending.failureDelta : 0;
      if (failDelta !== 0) {
        next = this.move(next, currentId, failDelta);
      }
    }

    meta = this.getMeta(next);
    meta = { ...meta, pendingQuiz: null };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

    next = this.applyLanding(next, currentId);

    meta = this.getMeta(next);
    if (meta.winnerId != null) return { ...next, status: 'finished' };
    if (meta.pendingQuiz || next.pending) return next;
    return this.advanceTurnOrKeep(next, currentId);
  }

  private handleChooseTarget(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const pending = state.pending as any;
    if (
      !pending ||
      pending.type !== 'choose_target' ||
      pending.playerId !== currentId
    )
      return state;
    const targetPlayerId = Number((action.payload as any)?.targetPlayerId);
    if (!Number.isFinite(targetPlayerId)) return state;

    let meta = this.getMeta(state);
    const ctx = meta.pendingContext ?? null;
    if (!ctx || ctx.actorId !== currentId) return { ...state, pending: null };

    const actorPos = meta.positions?.[currentId] ?? 0;
    const targetPos = meta.positions?.[targetPlayerId] ?? 0;

    if (ctx.kind === 'swap') {
      meta = {
        ...meta,
        positions: {
          ...(meta.positions ?? {}),
          [currentId]: targetPos,
          [targetPlayerId]: actorPos,
        },
      };
      let next: GameStateEntity = {
        ...state,
        pending: null,
        metadata: { ...(state.metadata ?? {}), ...meta, pendingContext: null },
      };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} échange sa position avec ${this.playerName(next, targetPlayerId)}.`,
      );
      return this.turns.advanceTurn(next);
    }

    if (ctx.kind === 'gift') {
      let next: GameStateEntity = {
        ...state,
        pending: null,
        metadata: { ...(state.metadata ?? {}), ...meta, pendingContext: null },
      };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} offre un cadeau à ${this.playerName(next, targetPlayerId)}.`,
      );
      next = this.move(next, targetPlayerId, 1);
      next = this.move(next, currentId, 2);
      next = this.applyLanding(next, currentId);
      return this.turns.advanceTurn(next);
    }

    return { ...state, pending: null };
  }

  private ensurePawnSelection(state: GameStateEntity): GameStateEntity {
    const status = (state.status ?? '').toLowerCase();
    const players = Array.isArray(state.players) ? state.players : [];
    if (players.length < MINUIT_GAME.minPlayers) return state;
    const hasPendingPick = (state.pending as any)?.type === 'pick_pawn';
    const needsPawnSelection = players.some(
      (p) => !!p && !this.isBotLike(p) && !String(p.pawn ?? '').trim(),
    );
    const needsBotPawns = players.some(
      (p) => !!p && this.isBotLike(p) && !String(p.pawn ?? '').trim(),
    );
    if (status === 'started') {
      if (!needsPawnSelection && !needsBotPawns && !hasPendingPick) return state;
      const withBots = this.assignBotPawns(state);
      if (needsPawnSelection || hasPendingPick) {
        return this.queuePawnSelection(withBots);
      }
      return withBots;
    }
    if (status !== 'starting' && status !== 'setup') return state;
    // Always assign bot pawns early so humans cannot pick them.
    const withBots = this.assignBotPawns(state);
    const readyPlayers = Array.isArray(withBots.players)
      ? withBots.players
      : [];
    if (needsPawnSelection) {
      return this.queuePawnSelection(withBots);
    }
    return {
      ...withBots,
      status: 'started',
      turnIndex: readyPlayers.length ? 0 : -1,
      turn: {
        currentPlayerId: readyPlayers[0]?.id ?? null,
        direction: 1,
      },
    };
  }

  private queuePawnSelection(state: GameStateEntity): GameStateEntity {
    const pending = state.pending as any;
    if (pending && pending.type === 'pick_pawn') return state;
    const players = Array.isArray(state.players) ? state.players : [];
    const missing = players.filter(
      (p) => !!p && !this.isBotLike(p) && !String(p.pawn ?? '').trim(),
    );
    if (!missing.length) return state;
    const taken = new Set<string>(
      players
        .map((p) => (typeof p?.pawn === 'string' ? String(p.pawn).trim() : ''))
        .filter((pawn) => pawn.length > 0),
    );
    const choiceEntries = this.listPawnChoiceEntries(this.getMeta(state));
    const available = choiceEntries.filter((entry) => !taken.has(entry.title));
    const entries = available.length ? available : [...choiceEntries];
    const choices = entries.map((entry) => entry.label);
    const choiceMap = Object.fromEntries(entries.map((e) => [e.label, e.title]));
    const chooser = missing[0];
    const chooserLabel = this.playerName(state, chooser.id);
    return {
      ...state,
      pending: {
        type: 'pick_pawn',
        playerId: chooser.id,
        blocking: true,
        label: `C'est à ${chooserLabel} de choisir son pion, puis Entrée.`,
        choices,
        data: { choices, choiceMap },
      } as PendingState,
      turn: {
        ...(state.turn ?? { currentPlayerId: chooser.id, direction: 1 }),
        currentPlayerId: chooser.id,
        direction: 1,
      },
    };
  }

  private assignBotPawns(state: GameStateEntity): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const meta = this.getMeta(state);
    const assigned: Record<number, string> = { ...(meta.pawns ?? {}) };
    const taken = new Set<string>(
      Object.values(assigned)
        .map((pawn) => (typeof pawn === 'string' ? pawn.trim() : ''))
        .filter((pawn) => pawn.length > 0),
    );
    let changed = false;
    const assignedBots: Array<{ id: number; pawn: string }> = [];
    const updatedPlayers = players.map((p) => {
      if (!p) return p;
      const pawn = typeof p.pawn === 'string' ? String(p.pawn).trim() : '';
      if (!this.isBotLike(p)) {
        if (pawn.length > 0) {
          assigned[p.id] = pawn;
          taken.add(pawn);
        }
        return p;
      }
      if (pawn.length > 0) {
        assigned[p.id] = pawn;
        taken.add(pawn);
        return p;
      }
      const available = this.listPawnChoices(meta).find(
        (candidate) => !taken.has(candidate),
      );
      if (!available) return p;
      taken.add(available);
      assigned[p.id] = available;
      changed = true;
      assignedBots.push({ id: p.id, pawn: available });
      return { ...p, pawn: available };
    });
    const metaChanged = !this.arePawnsEqual(meta.pawns, assigned);
    if (!changed && !metaChanged) return state;
    const nextMeta: MinuitMetadata = { ...meta, pawns: assigned };
    let next: GameStateEntity = {
      ...state,
      players: updatedPlayers,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
    for (const bot of assignedBots) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, bot.id)} choisit le pion: ${bot.pawn}.`,
      );
    }
    return next;
  }

  private handlePickPawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const pending = state.pending as any;
    if (!pending || pending.type !== 'pick_pawn') return state;
    const playerId = Number(pending.playerId);
    if (!Number.isFinite(playerId)) return state;
    const requestedPawn = String((action.payload as any)?.pawn ?? '').trim();
    if (!requestedPawn) return state;
    const choiceMap =
      pending && typeof pending?.data?.choiceMap === 'object'
        ? (pending.data.choiceMap as Record<string, string>)
        : {};
    const resolvedPawn = String(choiceMap[requestedPawn] ?? requestedPawn).trim();
    if (!resolvedPawn) return state;
    const players = Array.isArray(state.players) ? state.players : [];
    const takenByOthers = new Set<string>(
      players
        .filter((p) => p?.id !== playerId)
        .map((p) => (typeof p?.pawn === 'string' ? p.pawn.trim() : ''))
        .filter((pawn) => pawn.length > 0),
    );
    if (takenByOthers.has(resolvedPawn)) return state;
    const updatedPlayers = players.map((p) =>
      p?.id === playerId ? { ...p, pawn: resolvedPawn } : p,
    );
    const meta = this.getMeta(state);
    const nextPawns: Record<number, string> = {
      ...(meta.pawns ?? {}),
      [playerId]: resolvedPawn,
    };
    let next: GameStateEntity = {
      ...state,
      players: updatedPlayers,
      pending: null,
      metadata: {
        ...(state.metadata ?? {}),
        ...{ ...meta, pawns: nextPawns },
      },
    };
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} choisit le pion: ${resolvedPawn}.`,
    );
    return this.ensurePawnSelection(next);
  }

  private listPawnChoices(meta: MinuitMetadata): string[] {
    return this.listPawnChoiceEntries(meta).map((entry) => entry.title);
  }

  private listPawnChoiceEntries(
    meta: MinuitMetadata,
  ): Array<{ title: string; label: string }> {
    const fromContent = Array.isArray(meta.pawnChoices)
      ? meta.pawnChoices
          .map((p) => ({
            title: String(p?.title ?? '').trim(),
            description: String((p as any)?.description ?? '').trim(),
          }))
          .filter((p) => p.title.length > 0)
          .map((p) => ({
            title: p.title,
            label: p.description ? `${p.title}: ${p.description}` : p.title,
          }))
      : [];
    if (fromContent.length) return fromContent;
    return MINUIT_PAWNS.map((title) => ({ title, label: title }));
  }

  private arePawnsEqual(
    a: Record<number, string> | undefined,
    b: Record<number, string>,
  ): boolean {
    const keys = new Set<string>([
      ...Object.keys(a ?? {}),
      ...Object.keys(b ?? {}),
    ]);
    for (const key of keys) {
      const ai = a ? a[Number(key)] ?? '' : '';
      const bi = b ? b[Number(key)] ?? '' : '';
      if (ai !== bi) return false;
    }
    return true;
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const pos = meta.positions?.[playerId] ?? 0;
    let tile = meta.tiles[pos] as MinuitTile | undefined;
    if (!tile) return next;

    const occupant = this.findOccupant(meta, playerId, pos);
    if (occupant != null) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} place ${this.pawnLabel(next, playerId)} sur une case occupée : recul d'une case.`,
      );
      next = this.move(next, playerId, -1);
      meta = this.getMeta(next);
      const afterPos = meta.positions?.[playerId] ?? 0;
      tile = meta.tiles[afterPos] as MinuitTile | undefined;
      if (!tile) return next;
    }

    const afterPos = meta.positions?.[playerId] ?? 0;
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} place ${this.pawnLabel(next, playerId)} en case ${afterPos + 1} (${tile.title}).`,
    );
    const description = String((tile as any)?.description ?? '').trim();
    if (description) {
      next = this.core.appendLog(next, description);
    }
    if (afterPos === 55) {
      meta = { ...meta, winnerId: playerId };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} atteint Minuit !`,
      );
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (tile.type === 'move') {
      const delta = typeof tile.delta === 'number' ? tile.delta : 0;
      const ignore = meta.statuses?.ignoreNextMalus?.[playerId] === true;
      if (ignore && delta < 0) {
        meta = {
          ...meta,
          statuses: {
            ...meta.statuses,
            ignoreNextMalus: {
              ...(meta.statuses.ignoreNextMalus ?? {}),
              [playerId]: false,
            },
          },
        };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        return this.core.appendLog(next, 'Malus ignoré.');
      }
      if (delta !== 0) {
        const beforePos = meta.positions?.[playerId] ?? 0;
        next = this.move(next, playerId, delta);
        const afterMeta = this.getMeta(next);
        const afterPos = afterMeta.positions?.[playerId] ?? beforePos;
        if (afterPos === beforePos) return next;
        return this.applyLanding(next, playerId);
      }
      return next;
    }

    if (tile.type === 'skip') {
      const ignore = meta.statuses?.ignoreNextSkip?.[playerId] === true;
      if (ignore) {
        meta = {
          ...meta,
          statuses: {
            ...meta.statuses,
            ignoreNextSkip: {
              ...(meta.statuses.ignoreNextSkip ?? {}),
              [playerId]: false,
            },
          },
        };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        return this.core.appendLog(next, 'Passe ton tour ignoré.');
      }
      const turns = typeof tile.skipTurns === 'number' ? tile.skipTurns : 1;
      const curr = meta.statuses?.skipTurn?.[playerId] ?? 0;
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          skipTurn: {
            ...(meta.statuses.skipTurn ?? {}),
            [playerId]: curr + turns,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return next;
    }

    if (tile.type === 'card') {
      return {
        ...next,
        pending: {
          type: 'draw',
          playerId,
          blocking: true,
          label: 'Piocher une carte Noël (Espace).',
        },
      };
    }

    return next;
  }

  private applyCard(
    state: GameStateEntity,
    playerId: number,
    card: MinuitCard,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const text = (card.lines ?? []).join(' ');

    const quiz = this.parseQuizCard(playerId, card);
    if (quiz) {
      meta = { ...meta, pendingQuiz: quiz };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return next;
    }

    if (/échangez votre position avec un autre joueur/i.test(text)) {
      const targets = this.otherPlayers(next, playerId);
      const pending: PendingState = {
        type: 'choose_target',
        label: 'Choisissez un joueur dans la liste, puis Entrée.',
        playerId,
        blocking: true,
        choices: targets.map((t) => t.username),
        data: {
          targets: targets.map((t) => ({
            targetPlayerId: t.id,
            targetUsername: t.username,
          })),
        },
      };
      meta = { ...meta, pendingContext: { kind: 'swap', actorId: playerId } };
      return {
        ...next,
        pending,
        metadata: { ...(next.metadata ?? {}), ...meta },
      };
    }

    if (/vous offrez un cadeau à un autre joueur/i.test(text)) {
      const targets = this.otherPlayers(next, playerId);
      const pending: PendingState = {
        type: 'choose_target',
        label: 'Choisissez un joueur dans la liste, puis Entrée.',
        playerId,
        blocking: true,
        choices: targets.map((t) => t.username),
        data: {
          targets: targets.map((t) => ({
            targetPlayerId: t.id,
            targetUsername: t.username,
          })),
        },
      };
      meta = { ...meta, pendingContext: { kind: 'gift', actorId: playerId } };
      return {
        ...next,
        pending,
        metadata: { ...(next.metadata ?? {}), ...meta },
      };
    }

    if (/Ignorez la prochaine case malus/i.test(text)) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          ignoreNextMalus: {
            ...(meta.statuses.ignoreNextMalus ?? {}),
            [playerId]: true,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(next, 'Protection malus activée.');
    }

    if (/Ignorez la prochaine case.*Passe ton tour/i.test(text)) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          ignoreNextSkip: {
            ...(meta.statuses.ignoreNextSkip ?? {}),
            [playerId]: true,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        'Protection « passe ton tour » activée.',
      );
    }

    // Autres joueurs +1 (sauf vous).
    if (/Les autres joueurs avancent de 1 case, sauf vous/i.test(text)) {
      const others = Object.keys(meta.positions ?? {})
        .map(Number)
        .filter((id) => Number.isFinite(id) && id !== playerId);
      const updated = { ...(meta.positions ?? {}) };
      for (const id of others) {
        updated[id] = clamp((updated[id] ?? 0) + 1, 0, 55);
      }
      meta = { ...meta, positions: updated };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    // Force pioche au prochain tour (au lieu de lancer le dé).
    if (/Piochez à nouveau une carte au lieu de lancer le dé/i.test(text)) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          forceDrawNextTurn: {
            ...(meta.statuses.forceDrawNextTurn ?? {}),
            [playerId]: true,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        'Au prochain tour, piochez une carte à la place du dé.',
      );
    }

    // Aller à la case neutre la plus proche derrière.
    if (/case neutre la plus proche derrière/i.test(text)) {
      const pos = meta.positions[playerId] ?? 0;
      const prevPos = findPrev(meta.tiles, pos, (t) => t.type === 'neutral');
      if (prevPos != null) {
        next = this.core.appendLog(
          next,
          'Retour à la case neutre la plus proche derrière.',
        );
        next = this.setPos(next, playerId, prevPos);
        return this.applyLanding(next, playerId);
      }
    }

    const skip = extractSkipTurns(text);
    if (skip > 0) {
      const curr = meta.statuses?.skipTurn?.[playerId] ?? 0;
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          skipTurn: {
            ...(meta.statuses.skipTurn ?? {}),
            [playerId]: curr + skip,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} passe ${skip} tour(s).`,
      );
    }

    if (/jusqu['’]à la prochaine Carte Noël/i.test(text)) {
      const nextPos = findNext(
        meta.tiles,
        meta.positions[playerId] ?? 0,
        (t) => t.type === 'card',
      );
      if (nextPos != null) {
        next = this.core.appendLog(
          next,
          "Avance jusqu'à la prochaine Carte Noël.",
        );
        next = this.setPos(next, playerId, nextPos);
        return this.applyLanding(next, playerId);
      }
    }

    if (/jusqu['’]à la case précédente Carte Noël/i.test(text)) {
      const prevPos = findPrev(
        meta.tiles,
        meta.positions[playerId] ?? 0,
        (t) => t.type === 'card',
      );
      if (prevPos != null) {
        next = this.core.appendLog(
          next,
          "Recule jusqu'à la précédente Carte Noël.",
        );
        next = this.setPos(next, playerId, prevPos);
        return this.applyLanding(next, playerId);
      }
    }

    if (/position avec le joueur juste derrière/i.test(text)) {
      const behind = findBehind(meta.positions, playerId);
      if (behind != null) {
        const actorPos = meta.positions[playerId] ?? 0;
        const behindPos = meta.positions[behind] ?? 0;
        meta = {
          ...meta,
          positions: {
            ...meta.positions,
            [playerId]: behindPos,
            [behind]: actorPos,
          },
        };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        next = this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} échange sa position avec ${this.playerName(next, behind)}.`,
        );
        return next;
      }
    }

    if (
      /Relancez immédiatement le dé/i.test(text) ||
      /Relancez le dé maintenant/i.test(text)
    ) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          keepTurn: {
            ...(meta.statuses.keepTurn ?? {}),
            [playerId]: (meta.statuses.keepTurn?.[playerId] ?? 0) + 1,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(next, `${this.playerName(next, playerId)} rejoue.`);
    }

    if (/Lancez le dé et avancez du nombre obtenu/i.test(text)) {
      const rng = this.random.rollDice(meta as any, 6);
      meta = { ...meta, ...rng.meta };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = this.core.appendLog(next, `Bonus : dé = "${rng.roll}".`);
      next = this.move(next, playerId, rng.roll);
      return this.applyLanding(next, playerId);
    }

    const delta = extractMoveDelta(text);
    if (delta !== 0) {
      next = this.move(next, playerId, delta);
      return this.applyLanding(next, playerId);
    }

    return next;
  }

  private formatCardEffect(card: MinuitCard): string {
    const lines = Array.isArray(card.lines) ? card.lines : [];
    const filtered = lines.filter(
      (line) =>
        !/^si le joueur a la bonne réponse/i.test(String(line ?? '').trim()),
    );
    const withoutChoices = filtered.filter(
      (line) => !/^[*]?[abc]\)/i.test(String(line ?? '').trim()),
    );
    const isQuiz = filtered.some((line) =>
      /^[*]?[abc]\)/i.test(String(line ?? '').trim()),
    );
    if (isQuiz) {
      const question =
        withoutChoices.find((l) => String(l).includes('?')) ??
        withoutChoices[0] ??
        '';
      return String(question).trim();
    }
    return withoutChoices.join(' ').trim();
  }

  private move(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const pos = meta.positions?.[playerId] ?? 0;
    const nextPos = bounce(pos + delta, 55);
    return this.setPos(state, playerId, nextPos);
  }

  private setPos(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const nextPos = clamp(pos, 0, 55);
    const nextMeta: MinuitMetadata = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: nextPos },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private drawCard(meta: MinuitMetadata): {
    card: MinuitCard | null;
    meta: MinuitMetadata;
  } {
    const deck = Array.isArray(meta.decks?.cards) ? meta.decks.cards : [];
    const discard = Array.isArray(meta.decks?.discard)
      ? meta.decks.discard
      : [];
    if (!deck.length && discard.length) {
      const shuffled = this.random.shuffle(meta as any, discard);
      const reshuffled: MinuitMetadata = {
        ...meta,
        ...shuffled.meta,
        decks: { cards: shuffled.values as any, discard: [] },
      };
      return this.drawCard(reshuffled);
    }
    if (!deck.length) return { card: null, meta };
    const [card, ...rest] = deck;
    return {
      card,
      meta: { ...meta, decks: { cards: rest, discard: [...discard, card] } },
    };
  }

  private parseQuizCard(
    playerId: number,
    card: MinuitCard,
  ): MinuitPendingQuiz | null {
    const lines = Array.isArray(card.lines) ? card.lines : [];
    const choiceLines = lines.filter((l) => /^[*]?[abc]\)/i.test(l.trim()));
    if (!choiceLines.length) return null;

    const question = (
      lines.find((l) => l.includes('?')) ??
      lines[0] ??
      'Quiz'
    ).trim();
    const choices = choiceLines.map((l) =>
      l.replace(/^[*]?[abc]\)\s*/i, '').trim(),
    );
    const answerLine = choiceLines.find((l) => l.trim().startsWith('*')) ?? '';
    const answer = answerLine
      ? answerLine.replace(/^[*]?[abc]\)\s*/i, '').trim()
      : undefined;
    const anyCorrect = lines.some((l) =>
      /Les trois réponses sont just(e|es)/i.test(l),
    );
    const fullText = lines.join(' ');
    const successDelta = extractMoveDelta(fullText);
    const failureDelta = extractFailureDelta(fullText);
    return {
      playerId,
      question,
      choices,
      answer,
      anyCorrect,
      successDelta,
      failureDelta,
    };
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

  private findOccupant(
    meta: MinuitMetadata,
    me: number,
    pos: number,
  ): number | null {
    for (const [id, p] of Object.entries(meta.positions ?? {})) {
      const pid = Number(id);
      if (!Number.isFinite(pid) || pid === me) continue;
      if ((p ?? 0) === pos) return pid;
    }
    return null;
  }

  private getMeta(state: GameStateEntity): MinuitMetadata {
    return (state.metadata ?? {}) as any as MinuitMetadata;
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

  private pawnLabel(state: GameStateEntity, id: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const player = players.find((p) => p?.id === id);
    const pawn = String(player?.pawn ?? '').trim();
    if (pawn) return `"${pawn}"`;
    return 'un pion';
  }

  private advanceTurnOrKeep(state: GameStateEntity, playerId: number): GameStateEntity {
    const meta = this.getMeta(state);
    const keep = meta.statuses?.keepTurn?.[playerId] ?? 0;
    if (keep > 0) {
      const nextMeta: MinuitMetadata = {
        ...meta,
        statuses: {
          ...meta.statuses,
          keepTurn: {
            ...(meta.statuses.keepTurn ?? {}),
            [playerId]: Math.max(0, keep - 1),
          },
        },
      };
      return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
    }
    return this.turns.advanceTurn(state);
  }
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function bounce(target: number, max: number): number {
  if (target < 0) return 0;
  if (target === max) return max;
  if (target < max) return target;
  const over = target - max;
  return max - over;
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
    /avancez?\s+(?:de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+cases?/i,
  );
  if (forward) return parse(forward[1]);
  const backward = text.match(
    /reculez?\s+(?:de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+cases?/i,
  );
  if (backward) return -parse(backward[1]);
  return 0;
}

function extractFailureDelta(text: string): number {
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
  const backward = text.match(
    /sinon[^.]*reculez?\s+(?:de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+cases?/i,
  );
  if (backward) return -parse(backward[1]);
  const forward = text.match(
    /sinon[^.]*avancez?\s+(?:de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+cases?/i,
  );
  if (forward) return parse(forward[1]);
  return 0;
}

function extractSkipTurns(text: string): number {
  if (/Passez trois tours/i.test(text)) return 3;
  if (/Passez deux tours/i.test(text)) return 2;
  if (/Passez un tour/i.test(text)) return 1;
  if (/Passez votre tour/i.test(text) || /Passe ton tour/i.test(text)) return 1;
  if (/Vous passez trois tours/i.test(text)) return 3;
  if (/Vous passez deux tours/i.test(text)) return 2;
  if (/Vous passez un tour/i.test(text)) return 1;
  return 0;
}

function findNext<T>(
  items: T[],
  start: number,
  predicate: (v: any) => boolean,
): number | null {
  for (let i = start + 1; i < items.length; i += 1) {
    if (predicate(items[i])) return i;
  }
  return null;
}

function findPrev<T>(
  items: T[],
  start: number,
  predicate: (v: any) => boolean,
): number | null {
  for (let i = start - 1; i >= 0; i -= 1) {
    if (predicate(items[i])) return i;
  }
  return null;
}

function findBehind(
  positions: Record<number, number>,
  playerId: number,
): number | null {
  const entries = Object.entries(positions).map(([id, pos]) => ({
    id: Number(id),
    pos: Number(pos),
  }));
  const ranked = entries
    .filter((e) => Number.isFinite(e.id))
    .sort((a, b) => a.pos - b.pos);
  const idx = ranked.findIndex((e) => e.id === playerId);
  if (idx <= 0) return null;
  return ranked[idx - 1].id;
}
