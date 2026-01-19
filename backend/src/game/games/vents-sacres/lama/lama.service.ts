import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { RandomService } from '../../../modules/random/services/random.service';
import type { LamaCardValue, LamaMetadata } from './model/lama.model';
import { lamaCardLabel, lamaCardScore, nextLamaValue, LAMA_VALUE } from './model/lama.model';
import { LamaPresenter } from './lama.presenter';
import type { GameShortcutHint, GameShortcutsContext } from '../../../engine/shortcuts/game-shortcuts';
import { actionShortcut, interfaceShortcut } from '../../../engine/shortcuts/shortcut-utils';

@Injectable()
export class LamaService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'lama';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents Sacrés';
  readonly displayName = 'LAMA';
  readonly description = 'Défaussez vos cartes ou sortez de la manche pour minimiser vos jetons.';
  readonly minPlayers = 2;
  readonly maxPlayers = 6;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly random: RandomService,
    private readonly presenter: LamaPresenter,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const status = String(baseState.status ?? '').toLowerCase().trim();
    if (status !== 'started') {
      // In room setup, the engine will not expose actions/pending anyway.
      // Keep the state mostly untouched; the real game state is built when the room becomes "started".
      return {
        ...baseState,
        metadata: {
          ...(baseState.metadata ?? {}),
        } as any,
      };
    }

    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const metaAny = (baseState.metadata ?? {}) as any;
    const ownerPlayerId =
      typeof metaAny.roomOwnerId === 'number'
        ? metaAny.roomOwnerId
        : (players[0]?.id ?? null);
    const scoresByPlayerId: Record<string, number> = {};
    for (const p of players) {
      if (!p?.id) continue;
      scoresByPlayerId[String(p.id)] = 0;
    }

    const meta: LamaMetadata = {
      rng: typeof baseState.metadata === 'object' && baseState.metadata ? (baseState.metadata as any).rng : undefined,
      ownerPlayerId,
      loseAtScore: null,
      roundPauseSeconds: null,
      allowPlayAfterDraw: false,
      roundPauseUntilMs: null,
      roundNumber: 1,
      roundStarterIndex: 0,
      deck: [],
      discard: [],
      handsByPlayerId: {},
      droppedOutByPlayerId: {},
      scoresByPlayerId,
      step: 'setup_config',
      turnTracker: { playerId: ownerPlayerId, drawn: false, played: false },
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
      winnerId: null,
    };

    return {
      ...baseState,
      status: 'started',
      phase: 'setup',
      round: baseState.round ?? 0,
      turnIndex: baseState.turnIndex ?? 0,
      lastRoll: null,
      // Internal pending is used by the engine to detect stale bot timers.
      // The presenter builds the real user-facing pending state.
      pending: { step: 'setup_config', playerId: ownerPlayerId } as any,
      log: Array.isArray(baseState.log) ? baseState.log : [],
      metadata: meta as any,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: ownerPlayerId,
        direction: 1,
        label: ownerPlayerId
          ? `Réglages LAMA : ${players.find((p) => p?.id === ownerPlayerId)?.username ?? `#${ownerPlayerId}`}`
          : 'Réglages LAMA',
      },
    };
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      next = this.applyOne(next, action);
    }
    return next;
  }

  private static asNumberOrNull(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const n = Number(value.trim());
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  private static asBoolean(value: unknown): boolean {
    if (value === true) return true;
    if (value === false) return false;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const t = value.trim().toLowerCase();
      if (t === 'true' || t === '1' || t === 'yes' || t === 'oui' || t === 'on') return true;
      if (t === 'false' || t === '0' || t === 'no' || t === 'non' || t === 'off') return false;
    }
    return false;
  }

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];
    if (String(state.status ?? '').toLowerCase() !== 'started') return [];

    const meta = (state.metadata ?? {}) as LamaMetadata;
    if (meta.winnerId) return [];

    const step = meta.step ?? 'turn_choice';
    if (step === 'round_pause' || step === 'setup_config') {
      return [];
    }
    if (step === 'return_token') {
      if (meta.pendingReturnPlayerId !== botPlayerId) return [];
      const score = Number((meta.scoresByPlayerId ?? {})[String(botPlayerId)] ?? 0);
      if (score >= 10) return [{ type: 'lama_return', payload: { value: 10 } }];
      if (score >= 1) return [{ type: 'lama_return', payload: { value: 1 } }];
      return [{ type: 'lama_return', payload: { value: 0 } }];
    }

    if (meta.droppedOutByPlayerId[String(botPlayerId)]) {
      return [];
    }

    const trackerRaw = (meta as any)?.turnTracker ?? null;
    const trackerPlayerId = LamaService.asNumberOrNull(trackerRaw?.playerId);
    const trackerDrawn = LamaService.asBoolean(trackerRaw?.drawn);
    const trackerPlayed = LamaService.asBoolean(trackerRaw?.played);
    const sameTurn = trackerPlayerId === botPlayerId;

    const hand = (meta.handsByPlayerId ?? {})[String(botPlayerId)] ?? [];
    const discard = Array.isArray(meta.discard) ? meta.discard : [];
    const top = discard.length ? (discard[discard.length - 1] as LamaCardValue) : null;
    if (!top) return [];

    const canPlayValues = new Set<LamaCardValue>([top, nextLamaValue(top)]);

    const counts = new Map<LamaCardValue, number>();
    for (const v of hand as LamaCardValue[]) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    // Heuristique simple :
    // - si on peut jouer, jouer une carte jouable (priorité à la valeur avec le plus de duplicats)
    // - sinon piocher si possible
    let best: { value: LamaCardValue; count: number } | null = null;
    for (const [value, count] of counts.entries()) {
      if (!canPlayValues.has(value)) continue;
      if (!best || count > best.count) {
        best = { value, count };
      }
    }

    if (best) {
      return [{ type: 'lama_play', payload: { value: best.value, count: 1 } }];
    }

    // Règle: une seule pioche par tour. En mode "jouer après pioche", si le bot a déjà pioché
    // et ne peut pas jouer, il passe (sinon boucle infinie possible si le tracker est sérialisé).
    if (meta.allowPlayAfterDraw && sameTurn && trackerDrawn && !trackerPlayed) {
      return [{ type: 'lama_pass', payload: {} }];
    }

    if ((meta.deck ?? []).length > 0) {
      return [{ type: 'draw', payload: {} }];
    }

    // If cannot play and cannot draw, withdraw from the round.
    return [{ type: 'lama_quit', payload: {} }];
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }

  getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[] {
    if (!ctx?.started) return [];

    const meta: any = ctx?.metadata ?? {};
    const allowPlayAfterDraw = Boolean(meta?.allowPlayAfterDraw);
    const tracker = meta?.turnTracker ?? null;
    const isSameTurn = LamaService.asNumberOrNull(tracker?.playerId) === (ctx?.currentPlayerId ?? null);
    const canPass =
      allowPlayAfterDraw &&
      isSameTurn &&
      LamaService.asBoolean(tracker?.drawn) &&
      !LamaService.asBoolean(tracker?.played);

    const topDiscard = Array.isArray(meta?.discard) && meta.discard.length
      ? (meta.discard[meta.discard.length - 1] as any)
      : null;
    const hand: any[] = Array.isArray(meta?.handsByPlayerId?.[String(ctx?.currentPlayerId ?? '')])
      ? meta.handsByPlayerId[String(ctx.currentPlayerId)]
      : [];
    const canActuallyPlayAfterDraw =
      allowPlayAfterDraw &&
      topDiscard != null &&
      hand.some((v) => v === topDiscard || v === nextLamaValue(topDiscard));

    return [
      interfaceShortcut('C', 'discard'),
      interfaceShortcut('E', 'hands'),
      interfaceShortcut('S', 'score'),
      ...(canPass && canActuallyPlayAfterDraw ? [actionShortcut('T', 'lama_pass')] : []),
      actionShortcut('P', 'lama_quit'),
    ];
  }

  private applyOne(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const type = String(action?.type ?? '').trim();
    if (!type) return state;

    const actorId =
      typeof (action as any)?.meta?.actorId === 'number'
        ? (action as any).meta.actorId
        : state.turn?.currentPlayerId ?? null;
    if (!actorId) return state;

    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    if (meta.winnerId) return state;

    const players = Array.isArray(state.players) ? state.players : [];

    const status = String(state.status ?? '').toLowerCase();

    // Info actions: allowed for anyone, do not consume a turn.
    if (type === 'lama_peek_discard' || type === 'lama_preview') {
      if (type === 'lama_preview') return state;
      const discard = Array.isArray(meta.discard) ? meta.discard : [];
      const top = discard.length ? (discard[discard.length - 1] as LamaCardValue) : null;
      const name = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
      const log = Array.isArray(state.log) ? [...state.log] : [];
      log.push({ message: `${name} regarde la défausse : ${top ? lamaCardLabel(top) : '(vide)'}.` });
      return { ...state, log };
    }

    // Setup (single step): owner configures losing score + pause, then the first round starts.
    if ((meta.step ?? '') === 'setup_config') {
      if (type !== 'lama_set_config') return state;
      if (meta.ownerPlayerId == null || actorId !== meta.ownerPlayerId) return state;

      const rawLose = Number((action.payload as any)?.loseAtScore);
      const loseAtScore = Number.isFinite(rawLose) ? Math.floor(rawLose) : NaN;
      if (!Number.isFinite(loseAtScore) || loseAtScore < 5 || loseAtScore > 200) return state;

      const rawPause = Number((action.payload as any)?.roundPauseSeconds);
      const roundPauseSeconds = Number.isFinite(rawPause) ? Math.floor(rawPause) : NaN;
      if (!Number.isFinite(roundPauseSeconds) || roundPauseSeconds < 0 || roundPauseSeconds > 120) return state;

      const rawAfterDraw = Number((action.payload as any)?.allowPlayAfterDraw);
      const allowPlayAfterDraw = Number.isFinite(rawAfterDraw) ? Math.floor(rawAfterDraw) === 1 : false;

      const updatedMeta: LamaMetadata = {
        ...meta,
        loseAtScore,
        roundPauseSeconds,
        allowPlayAfterDraw,
        roundPauseUntilMs: null,
        step: 'turn_choice',
        roundNumber: 1,
        roundStarterIndex: 0,
        turnTracker: { playerId: null, drawn: false, played: false },
        pendingReturnQueue: [],
        pendingReturnPlayerId: null,
      };

      const log = Array.isArray(state.log) ? [...state.log] : [];
      const name = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
      log.push({ message: `${name} fixe la défaite à ${loseAtScore} jetons.` });
      log.push({ message: `${name} règle la pause entre manches à ${roundPauseSeconds}s.` });
      log.push({
        message: allowPlayAfterDraw
          ? `${name} autorise à jouer après avoir pioché (même tour).`
          : `${name} interdit de jouer après avoir pioché (tour suivant).`,
      });
      log.push({ message: `Début de la partie.` });

      return this.startNewRound(
        {
          ...state,
          status: 'started',
          phase: 'round',
          round: 1,
          turnIndex: state.turnIndex ?? 0,
          lastRoll: null,
          pending: null,
          log,
          metadata: updatedMeta as any,
        },
        updatedMeta.roundStarterIndex,
      );
    }

    // System: resume a round after the configured pause (does not require turn ownership).
    if ((meta.step ?? '') === 'round_pause') {
      if (type !== 'lama_resume_round') return state;
      const until = typeof meta.roundPauseUntilMs === 'number' ? meta.roundPauseUntilMs : null;
      if (until != null && Date.now() < until) {
        return state;
      }
      const clearedMeta: LamaMetadata = {
        ...meta,
        roundPauseUntilMs: null,
        step: 'turn_choice',
      };
      return this.startNewRound(
        {
          ...state,
          turnIndex: (state.turnIndex ?? 0) + 1,
          metadata: clearedMeta as any,
          phase: 'round',
          round: Number(clearedMeta.roundNumber ?? state.round ?? 1),
        },
        Number(clearedMeta.roundStarterIndex ?? 0),
      );
    }

    if (status !== 'started') {
      return state;
    }

    // Enforce turn order: only the current player can act (for turn-consuming actions).
    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    if (currentPlayerId == null || actorId !== currentPlayerId) {
      return state;
    }

    const ensureTurnTracker = (m: LamaMetadata, pid: number): LamaMetadata => {
      const current = (m as any).turnTracker ?? { playerId: pid, drawn: false, played: false };
      const currentPid = LamaService.asNumberOrNull(current?.playerId);
      if (currentPid !== pid) {
        return { ...m, turnTracker: { playerId: pid, drawn: false, played: false } };
      }

      // Normalise les types (évite "2" !== 2, "true"/"false" etc).
      return {
        ...m,
        turnTracker: {
          playerId: pid,
          drawn: LamaService.asBoolean(current?.drawn),
          played: LamaService.asBoolean(current?.played),
        },
      };
    };

    const metaForTurn = ensureTurnTracker(meta, actorId);

    // Pending: return token decision.
    if ((meta.step ?? 'turn_choice') === 'return_token') {
      if (meta.pendingReturnPlayerId !== actorId) {
        return state;
      }
      if (String(action.type ?? '') !== 'lama_return') {
        return state;
      }
      const value = Number((action.payload as any)?.value ?? 0);
      const currentScore = Number((meta.scoresByPlayerId ?? {})[String(actorId)] ?? 0);
      const delta = value === 10 ? 10 : value === 1 ? 1 : 0;
      const nextScore = Math.max(0, currentScore - delta);
      const scoresByPlayerId = { ...(meta.scoresByPlayerId ?? {}) };
      scoresByPlayerId[String(actorId)] = nextScore;

      const log = Array.isArray(state.log) ? [...state.log] : [];
      const name = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
      if (delta == 10) log.push({ message: `${name} rend 1 diamant (10 jetons).` });
      else if (delta == 1) log.push({ message: `${name} rend 1 jeton.` });
      else log.push({ message: `${name} ne rend rien.` });

      const queue = Array.isArray(meta.pendingReturnQueue) ? [...meta.pendingReturnQueue] : [];
      const remaining = queue.filter((id) => id !== actorId);
      const nextPending = remaining.length ? remaining[0] : null;
      const nextMeta: LamaMetadata = {
        ...meta,
        scoresByPlayerId,
        pendingReturnQueue: remaining,
        pendingReturnPlayerId: nextPending,
        step: nextPending ? 'return_token' : 'turn_choice',
      };

      let nextState: GameStateEntity = {
        ...state,
        metadata: nextMeta as any,
        log,
        turnIndex: (state.turnIndex ?? 0) + 1,
        pending: {
          step: nextMeta.step,
          playerId: nextMeta.pendingReturnPlayerId ?? null,
        } as any,
        turn: {
          ...(state.turn ?? { direction: 1 }),
          currentPlayerId: nextPending ?? state.turn?.currentPlayerId ?? null,
          direction: 1,
          label: nextPending
            ? `Rendre des jetons : ${players.find((p) => p?.id === nextPending)?.username ?? `#${nextPending}`}`
            : undefined,
        },
      };

      if (nextPending) {
        return nextState;
      }

      // End-of-round: check game over / start next round.
      return this.finishRoundAndMaybeStartNext(nextState);
    }

    if (type === 'draw') {
      if (meta.droppedOutByPlayerId[String(actorId)]) return state;
      try {
        const players = Array.isArray(state.players) ? state.players : [];
        const current = players.find((p: any) => p?.id === actorId) as any;
        const isBot = Boolean(current?.isBot);
        const tracker = metaForTurn.turnTracker ?? null;
        const alreadyDrawn =
          LamaService.asNumberOrNull((tracker as any)?.playerId) === actorId &&
          LamaService.asBoolean((tracker as any)?.drawn);
        if (isBot && !alreadyDrawn) {
          const name = current?.username ?? `#${actorId}`;
          const log = Array.isArray(state.log) ? [...state.log] : [];
          log.push({ message: `${name} doit piocher.` });
          return this.applyDraw({ ...state, log }, metaForTurn, actorId);
        }
      } catch {
        // ignore
      }
      return this.applyDraw(state, metaForTurn, actorId);
    }

    if (type === 'lama_quit') {
      return this.applyQuit(state, metaForTurn, actorId);
    }

    if (type === 'lama_pass') {
      if (metaForTurn.droppedOutByPlayerId[String(actorId)]) return state;
      return this.applyPass(state, metaForTurn, actorId);
    }

    if (type === 'lama_play') {
      if (meta.droppedOutByPlayerId[String(actorId)]) return state;
      return this.applyPlay(state, metaForTurn, actorId, action);
    }

    return state;
  }

  private applyDraw(state: GameStateEntity, meta: LamaMetadata, actorId: number): GameStateEntity {
    const tracker = meta.turnTracker ?? { playerId: actorId, drawn: false, played: false };
    if (LamaService.asNumberOrNull((tracker as any).playerId) === actorId && LamaService.asBoolean((tracker as any).drawn)) {
      return state;
    }

    const deck = Array.isArray(meta.deck) ? [...meta.deck] : [];
    if (deck.length <= 0) return state;
    const card = deck.pop() as LamaCardValue;
    const handsByPlayerId = { ...(meta.handsByPlayerId ?? {}) };
    const hand = [...((handsByPlayerId[String(actorId)] as LamaCardValue[]) ?? [])];
    hand.push(card);
    handsByPlayerId[String(actorId)] = hand;

    const players = Array.isArray(state.players) ? state.players : [];
    const name = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `${name} pioche.` });

    const allowPlayAfterDraw = Boolean(meta.allowPlayAfterDraw);

    const topDiscard = Array.isArray(meta.discard) && meta.discard.length
      ? (meta.discard[meta.discard.length - 1] as LamaCardValue)
      : null;
    const canPlayAfterDraw =
      allowPlayAfterDraw &&
      topDiscard != null &&
      hand.some((v) => v === topDiscard || v === nextLamaValue(topDiscard));

    const nextMeta: LamaMetadata = {
      ...meta,
      deck,
      handsByPlayerId,
      turnTracker: allowPlayAfterDraw
        ? { playerId: actorId, drawn: true, played: false }
        : meta.turnTracker,
    };

    if (allowPlayAfterDraw && !canPlayAfterDraw)
    {
      // La règle "jouer après pioche" est active, mais aucune carte jouable: le tour se termine automatiquement.
      log.push({ message: `${name} passe.` });
    }

    const nextPlayerId = canPlayAfterDraw
      ? actorId
      : this.findNextActivePlayerId(players, nextMeta, actorId);

    const advancedMeta: LamaMetadata = canPlayAfterDraw
      ? nextMeta
      : { ...nextMeta, turnTracker: { playerId: nextPlayerId, drawn: false, played: false } };

    const nextState: GameStateEntity = {
      ...state,
      metadata: advancedMeta as any,
      log,
      pending: { step: 'turn_choice', playerId: nextPlayerId } as any,
      turnIndex: (state.turnIndex ?? 0) + 1,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: nextPlayerId,
        direction: 1,
        label: nextPlayerId
          ? `Tour de ${players.find((p) => p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`}`
          : undefined,
      },
    };

    // If the round end conditions are met, end the round.
    if (this.isRoundEnded(advancedMeta, players)) {
      const winnerId = this.findRoundWinnerId(advancedMeta, players);
      return this.endRound(nextState, winnerId);
    }

    return nextState;
  }

  private applyQuit(state: GameStateEntity, meta: LamaMetadata, actorId: number): GameStateEntity {
    const droppedOutByPlayerId = { ...(meta.droppedOutByPlayerId ?? {}) };
    if (droppedOutByPlayerId[String(actorId)]) return state;
    droppedOutByPlayerId[String(actorId)] = true;

    const players = Array.isArray(state.players) ? state.players : [];
    const name = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `${name} se retire de la manche.` });
    log.push({ message: `${name} ne jouera plus ; ses jetons seront comptés à la fin de la manche.` });

    const nextMeta: LamaMetadata = { ...meta, droppedOutByPlayerId };
    const nextStateBase: GameStateEntity = { ...state, metadata: nextMeta as any, log };

    if (this.isRoundEnded(nextMeta, players)) {
      const winnerId = this.findRoundWinnerId(nextMeta, players);
      return this.endRound(nextStateBase, winnerId);
    }

    const nextPlayerId = this.findNextActivePlayerId(players, nextMeta, actorId);
    return {
      ...nextStateBase,
      turnIndex: (state.turnIndex ?? 0) + 1,
      pending: { step: 'turn_choice', playerId: nextPlayerId } as any,
      metadata: { ...nextMeta, turnTracker: { playerId: nextPlayerId, drawn: false, played: false } } as any,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: nextPlayerId,
        direction: 1,
        label: nextPlayerId
          ? `Tour de ${players.find((p) => p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`}`
          : undefined,
      },
    };
  }

  private applyPass(state: GameStateEntity, meta: LamaMetadata, actorId: number): GameStateEntity {
    if (!meta.allowPlayAfterDraw) return state;
    const tracker = meta.turnTracker ?? { playerId: actorId, drawn: false, played: false };
    if (LamaService.asNumberOrNull((tracker as any).playerId) !== actorId ||
        !LamaService.asBoolean((tracker as any).drawn) ||
        LamaService.asBoolean((tracker as any).played)) {
      return state;
    }

    const players = Array.isArray(state.players) ? state.players : [];
    const name = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `${name} passe.` });

    const nextPlayerId = this.findNextActivePlayerId(players, meta, actorId);
    const nextMeta: LamaMetadata = {
      ...meta,
      turnTracker: { playerId: nextPlayerId, drawn: false, played: false },
    };

    const nextState: GameStateEntity = {
      ...state,
      metadata: nextMeta as any,
      log,
      pending: { step: 'turn_choice', playerId: nextPlayerId } as any,
      turnIndex: (state.turnIndex ?? 0) + 1,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: nextPlayerId,
        direction: 1,
        label: nextPlayerId
          ? `Tour de ${players.find((p) => p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`}`
          : undefined,
      },
    };

    if (this.isRoundEnded(nextMeta, players)) {
      const winnerId = this.findRoundWinnerId(nextMeta, players);
      return this.endRound(nextState, winnerId);
    }

    return nextState;
  }

  private applyPlay(
    state: GameStateEntity,
    meta: LamaMetadata,
    actorId: number,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const tracker = meta.turnTracker ?? { playerId: actorId, drawn: false, played: false };
    if (LamaService.asNumberOrNull((tracker as any).playerId) === actorId && LamaService.asBoolean((tracker as any).played)) {
      return state;
    }

    const rawValue = Number((action.payload as any)?.value);
    const value = (rawValue >= 1 && rawValue <= 7 ? rawValue : 0) as LamaCardValue;
    const count = 1;

    const discard = Array.isArray(meta.discard) ? [...meta.discard] : [];
    const top = discard.length ? (discard[discard.length - 1] as LamaCardValue) : null;
    if (!top) return state;

    const allowed = new Set<LamaCardValue>([top, nextLamaValue(top)]);
    if (!allowed.has(value)) return state;

    const handsByPlayerId = { ...(meta.handsByPlayerId ?? {}) };
    const hand = [...((handsByPlayerId[String(actorId)] as LamaCardValue[]) ?? [])];
    const availableCount = hand.filter((v) => v === value).length;
    if (availableCount < count) return state;

    // Remove `count` cards of that value.
    let removed = 0;
    const nextHand: LamaCardValue[] = [];
    for (const v of hand) {
      if (v === value && removed < count) {
        removed += 1;
        continue;
      }
      nextHand.push(v);
    }
    handsByPlayerId[String(actorId)] = nextHand;

    for (let i = 0; i < count; i += 1) {
      discard.push(value);
    }

    const players = Array.isArray(state.players) ? state.players : [];
    const name = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
    const log = Array.isArray(state.log) ? [...state.log] : [];
    const label = lamaCardLabel(value);
    log.push({ message: `${name} joue la carte ${label}.` });

    const nextMeta: LamaMetadata = {
      ...meta,
      handsByPlayerId,
      discard,
      turnTracker: { playerId: actorId, drawn: tracker.drawn, played: true },
    };

    // End round if player emptied hand.
    if (nextHand.length === 0) {
      const endedState: GameStateEntity = {
        ...state,
        metadata: nextMeta as any,
        log,
        turnIndex: (state.turnIndex ?? 0) + 1,
      };
      return this.endRound(endedState, actorId);
    }

    const nextPlayerId = this.findNextActivePlayerId(players, nextMeta, actorId);
    const nextState: GameStateEntity = {
      ...state,
      metadata: { ...nextMeta, turnTracker: { playerId: nextPlayerId, drawn: false, played: false } } as any,
      log,
      pending: { step: 'turn_choice', playerId: nextPlayerId } as any,
      turnIndex: (state.turnIndex ?? 0) + 1,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: nextPlayerId,
        direction: 1,
        label: nextPlayerId
          ? `Tour de ${players.find((p) => p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`}`
          : undefined,
      },
    };

    // If the deck is empty and nobody can play anymore, end the round.
    if (this.isRoundEnded(nextMeta, players)) {
      const winnerId = this.findRoundWinnerId(nextMeta, players);
      return this.endRound(nextState, winnerId);
    }

    return nextState;
  }

  private endRound(state: GameStateEntity, winnerPlayerId: number | null): GameStateEntity {
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    const players = Array.isArray(state.players) ? state.players : [];
    const handsByPlayerId = meta.handsByPlayerId ?? {};
    const scoresByPlayerId = { ...(meta.scoresByPlayerId ?? {}) };

    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `Fin de la manche ${meta.roundNumber}.` });

    for (const p of players) {
      if (!p?.id) continue;
      const pid = p.id;
      const hand = (handsByPlayerId[String(pid)] ?? []) as LamaCardValue[];
      const unique = [...new Set(hand)];
      const gained = unique.reduce((sum, v) => sum + lamaCardScore(v), 0);
      scoresByPlayerId[String(pid)] = Number(scoresByPlayerId[String(pid)] ?? 0) + gained;
      if (gained > 0) {
        log.push({ message: `${p.username ?? `#${pid}`} prend ${gained} jeton${gained > 1 ? 's' : ''} (pénalité).` });
      }
    }

    const winnerName =
      winnerPlayerId != null
        ? players.find((p) => p?.id === winnerPlayerId)?.username ?? `#${winnerPlayerId}`
        : null;
    if (winnerName) {
      log.push({ message: `${winnerName} gagne la manche.` });
    }

    // Le gagnant peut rendre 1 jeton ou 1 diamant (10 jetons) si possible.
    const eligible = winnerPlayerId != null ? [winnerPlayerId] : [];
    const nextMeta: LamaMetadata = {
      ...meta,
      scoresByPlayerId,
      step: eligible.length ? 'return_token' : 'turn_choice',
      pendingReturnQueue: eligible,
      pendingReturnPlayerId: eligible.length ? eligible[0] : null,
    };

    const nextState: GameStateEntity = {
      ...state,
      metadata: nextMeta as any,
      log,
      pending: { step: nextMeta.step, playerId: nextMeta.pendingReturnPlayerId ?? null } as any,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: eligible.length ? eligible[0] : state.turn?.currentPlayerId ?? null,
        direction: 1,
        label: eligible.length
          ? `Rendre des jetons : ${players.find((p) => p?.id === eligible[0])?.username ?? `#${eligible[0]}`}`
          : undefined,
      },
    };

    if (eligible.length) {
      return nextState;
    }

    return this.finishRoundAndMaybeStartNext(nextState);
  }

  private finishRoundAndMaybeStartNext(state: GameStateEntity): GameStateEntity {
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;
    const players = Array.isArray(state.players) ? state.players : [];

    const scores = meta.scoresByPlayerId ?? {};
    const highest = Math.max(
      0,
      ...Object.values(scores).map((v) => Number(v ?? 0)),
    );
    const loseAt = Number(meta.loseAtScore ?? 40);
    if (highest >= loseAt) {
      // Game over: lowest score wins.
      let winnerId: number | null = null;
      let best = Number.POSITIVE_INFINITY;
      for (const p of players) {
        const pid = p?.id;
        if (!pid) continue;
        const s = Number(scores[String(pid)] ?? 0);
        if (s < best) {
          best = s;
          winnerId = pid;
        }
      }
      const log = Array.isArray(state.log) ? [...state.log] : [];
      log.push({ message: `Partie terminée.` });
      if (winnerId) {
        log.push({ message: `Gagnant : ${players.find((p) => p?.id === winnerId)?.username ?? `#${winnerId}`}.` });
      }
      return {
        ...state,
        status: 'finished',
        log,
        metadata: {
          ...meta,
          winnerId,
          winnerPlayerId: winnerId,
        } as any,
      };
    }

    const nextRound = Number(meta.roundNumber ?? 1) + 1;
    const starter = (Number(meta.roundStarterIndex ?? 0) + 1) % Math.max(1, players.length);
    const pauseSeconds = Number(meta.roundPauseSeconds ?? 0);
    const pauseMs = Number.isFinite(pauseSeconds) ? Math.max(0, Math.floor(pauseSeconds) * 1000) : 0;
    const updatedMeta: LamaMetadata = {
      ...meta,
      roundNumber: nextRound,
      roundStarterIndex: starter,
      step: pauseMs > 0 ? 'round_pause' : 'turn_choice',
      roundPauseUntilMs: pauseMs > 0 ? Date.now() + pauseMs : null,
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
    };

    if (pauseMs > 0) {
      const log = Array.isArray(state.log) ? [...state.log] : [];
      log.push({ message: `Pause ${Math.floor(pauseMs / 1000)}s avant la manche ${nextRound}.` });
      return {
        ...state,
        phase: 'round',
        round: nextRound,
        log,
        metadata: updatedMeta as any,
        pending: { step: 'round_pause', playerId: meta.ownerPlayerId ?? null } as any,
        turn: {
          ...(state.turn ?? { direction: 1 }),
          currentPlayerId: meta.ownerPlayerId ?? state.turn?.currentPlayerId ?? null,
          direction: 1,
          label: `Pause avant la manche ${nextRound}`,
        },
      };
    }

    return this.startNewRound({ ...state, metadata: updatedMeta as any, round: nextRound }, starter);
  }

  private startNewRound(state: GameStateEntity, starterIndex: number): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const meta = { ...(state.metadata ?? {}) } as LamaMetadata;

    const baseDeck = this.buildDeck();
    const rngMeta = typeof meta.rng === 'object' && meta.rng ? { ...(meta.rng as any) } : {};
    const shuffled = this.random.shuffle(rngMeta, baseDeck);
    meta.rng = shuffled.meta;
    const deck = shuffled.values as LamaCardValue[];

    const handsByPlayerId: Record<string, LamaCardValue[]> = {};
    const droppedOutByPlayerId: Record<string, boolean> = {};
    for (const p of players) {
      if (!p?.id) continue;
      handsByPlayerId[String(p.id)] = [];
      droppedOutByPlayerId[String(p.id)] = false;
    }

    for (let i = 0; i < 6; i += 1) {
      for (const p of players) {
        if (!p?.id) continue;
        const card = deck.pop();
        if (!card) continue;
        handsByPlayerId[String(p.id)].push(card);
      }
    }

    const firstDiscard = deck.pop() ?? 1;
    const discard: LamaCardValue[] = [firstDiscard as LamaCardValue];

    const starterPlayerId = players[starterIndex]?.id ?? players[0]?.id ?? null;
    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `Début de la manche ${meta.roundNumber}. Défausse: ${lamaCardLabel(firstDiscard as LamaCardValue)}.` });

    const nextMeta: LamaMetadata = {
      ...meta,
      deck,
      discard,
      handsByPlayerId,
      droppedOutByPlayerId,
      step: 'turn_choice',
      turnTracker: { playerId: starterPlayerId, drawn: false, played: false },
      pendingReturnQueue: [],
      pendingReturnPlayerId: null,
    };

    return {
      ...state,
      metadata: nextMeta as any,
      log,
      pending: { step: 'turn_choice', playerId: starterPlayerId } as any,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: starterPlayerId,
        direction: 1,
        label: starterPlayerId
          ? `Tour de ${players.find((p) => p?.id === starterPlayerId)?.username ?? `#${starterPlayerId}`}`
          : undefined,
      },
    };
  }

  private buildDeck(): LamaCardValue[] {
    const deck: LamaCardValue[] = [];
    for (const v of [1, 2, 3, 4, 5, 6, LAMA_VALUE] as LamaCardValue[]) {
      for (let i = 0; i < 8; i += 1) deck.push(v);
    }
    return deck;
  }

  private isRoundEnded(meta: LamaMetadata, players: any[]): boolean {
    const hands = meta.handsByPlayerId ?? {};
    const dropped = meta.droppedOutByPlayerId ?? {};
    const ids = Object.keys(hands);
    if (ids.length === 0) return true;
    const someoneEmpty = ids.some((id) => (hands[id] ?? []).length === 0);
    if (someoneEmpty) return true;

    const active = ids.filter((id) => !dropped[id]);
    if (active.length <= 1) return true;
    const allDropped = active.length === 0;
    if (allDropped) return true;
    return false;
  }

  private findNextActivePlayerId(players: any[], meta: LamaMetadata, afterPlayerId: number): number | null {
    const ids = players.map((p) => p?.id).filter((id) => typeof id === 'number') as number[];
    if (!ids.length) return null;
    const start = Math.max(0, ids.indexOf(afterPlayerId));
    const dropped = meta.droppedOutByPlayerId ?? {};
    for (let step = 1; step <= ids.length; step += 1) {
      const pid = ids[(start + step) % ids.length]!;
      if (!dropped[String(pid)]) return pid;
    }
    return ids[start] ?? null;
  }

  private withTurnLabel(turn: any, players: any[], currentPlayerId: number): any {
    return {
      ...(turn ?? { direction: 1 }),
      currentPlayerId,
      direction: 1,
      label: `Tour de ${players.find((p) => p?.id === currentPlayerId)?.username ?? `#${currentPlayerId}`}`,
    };
  }

  private findEmptyHandWinnerId(meta: LamaMetadata, players: any[]): number | null {
    const hands = meta.handsByPlayerId ?? {};
    const ids = players.map((p) => p?.id).filter((id) => typeof id === 'number') as number[];
    for (const pid of ids) {
      const hand = (hands[String(pid)] ?? []) as LamaCardValue[];
      if (hand.length === 0) return pid;
    }
    return null;
  }

  private findRoundWinnerId(meta: LamaMetadata, players: any[]): number | null {
    const empty = this.findEmptyHandWinnerId(meta, players);
    if (empty != null) return empty;

    const hands = meta.handsByPlayerId ?? {};
    const dropped = meta.droppedOutByPlayerId ?? {};
    const ids = Object.keys(hands);
    const active = ids.filter((id) => !dropped[id]);
    if (active.length === 1) return Number(active[0]);
    return null;
  }
}
