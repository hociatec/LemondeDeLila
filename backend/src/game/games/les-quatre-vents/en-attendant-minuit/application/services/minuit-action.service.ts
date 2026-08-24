import type {
  GameStateEntity,
  PendingState,
} from '../../../../../application/models/game-state.model';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../../application/helpers/action-service.helper';
import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';

import type { GameSingleActionDto } from '../../../../../application/models/game-action.model';

import { GameCoreService } from '../../../../../application/services/game-core.service';
import { RandomService } from '../../../../../application/services/random.service';
import { SetupFlowService } from '../../../../../application/services/setup-flow.service';
import { DeckPoliciesService } from '../../../../../application/features/deck-policies/services/deck-policies.service';
import { TurnFlowService } from '../../../../../application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../../../application/services/turn-policies.service';
import { PromptPoliciesService } from '../../../../../application/services/prompt-policies.service';
import { applyConfiguredPawnSelection } from '../../../../../application/helpers/configured-pawn-selection.helper';
import {
  assignConfiguredBotPawns,
  queueConfiguredPawnSelection,
} from '../../../../../application/helpers/configured-pawn-setup.helper';
import {
  hasRecentPawnSelectionLogs,
  starterTurnAnnouncement,
  turnAnnouncement,
} from '../../../../../application/helpers/game-log-text.helper';
import { MINUIT_GAME } from '../../definitions/minuit.definition';
import type {
  MinuitCard,
  MinuitMetadata,
  MinuitPendingQuiz,
  MinuitTile,
} from '../../model/minuit.types';
import {
  asMinuitRecord,
  bounceMinuit,
  clampMinuit,
  describeMinuitPawnPossessive,
  extractMinuitFailureDelta,
  extractMinuitMoveDelta,
  extractMinuitSkipTurns,
  findBehindMinuit,
  findNextMinuit,
  findPrevMinuit,
  resolveMinuitPawnName,
  toMinuitText,
} from './minuit-action.utils';
import { applyMinuitCardEffect } from './minuit-card-effects.utils';

const MINUIT_PAWNS = [
  'Le Lutin',
  'Le Bonhomme de Neige',
  'La Fée des Flocons',
  'Le Père Noël',
  'Le Renne',
  "Le Petit Bonhomme en Pain d'Épices",
];

const MINUIT_PLAYER_NAME_OPTIONS = {
  coerceNumericIds: true,
} as const;
const MINUIT_MAX_LANDING_STEPS = 128;

type PendingPickPawn = {
  type?: string;
};

export class MinuitActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
    private readonly setupFlow: SetupFlowService,
    private readonly deckPolicies: DeckPoliciesService,
    private readonly turnPolicies?: TurnPoliciesService,
    private readonly promptPolicies?: PromptPoliciesService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const next = applyActionsSequentially(
      this.ensurePawnSelection(state),
      actions,
      (next, action) => {
        const type = normalizeActionType(action);
        return dispatchByActionType(
          type,
          {
            pick_pawn: () => {
              next = this.handlePickPawn(next, action);
              next = this.ensurePawnSelection(next);
              return next;
            },
            roll: () => {
              next = this.handleRoll(next);
              return next;
            },
            draw: () => {
              next = this.handleDraw(next);
              return next;
            },
            answer_quiz: () => {
              next = this.handleAnswerQuiz(next, action);
              return next;
            },
            choose_target: () => {
              next = this.handleChooseTarget(next, action);
              return next;
            },
          },
          () => next,
        );
      },
    );
    return next;
  }

  private isBotLike(player: unknown, meta?: MinuitMetadata): boolean {
    const playerRecord = asMinuitRecord(player);
    if (!playerRecord) return false;
    if (playerRecord.isBot === true) return true;
    const id = Number(playerRecord.id);
    if (Number.isFinite(id) && id < 0) return true;
    if (
      Number.isFinite(id) &&
      Array.isArray(meta?.botPlayerIds) &&
      meta.botPlayerIds.includes(id)
    ) {
      return true;
    }
    const username =
      typeof playerRecord.username === 'string'
        ? playerRecord.username.toLowerCase()
        : '';
    return username.includes('bot');
  }

  private hasPawnAssigned(player: unknown, meta: MinuitMetadata): boolean {
    const playerRecord = asMinuitRecord(player);
    const playerId = Number(playerRecord.id);
    if (!Number.isFinite(playerId)) return false;
    const playerPawn =
      typeof playerRecord.pawn === 'string' ? playerRecord.pawn.trim() : '';
    if (playerPawn.length > 0) return true;
    const metaPawn = String((meta.pawns ?? {})[playerId] ?? '').trim();
    return metaPawn.length > 0;
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
        `${resolvePlayerNameFromState(next, currentId, MINUIT_PLAYER_NAME_OPTIONS)} pioche une carte au lieu de lancer le dé.`,
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

    const rng = this.random.rollDice(meta, 6);
    meta = { ...meta, ...rng.meta };
    const roll = rng.roll;

    let next: GameStateEntity = {
      ...state,
      lastRoll: roll,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId, MINUIT_PLAYER_NAME_OPTIONS)} lance le dé : "${roll}".`,
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
    const pending = state.pending;
    if (!pending || pending.type !== 'draw') return state;

    const currentId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : (state.turn?.currentPlayerId ?? null);
    if (currentId == null) return state;

    let next: GameStateEntity = { ...state, pending: null };
    next = this.applyDrawCard(next, currentId);

    const meta = this.getMeta(next);
    if (meta.winnerId != null) return { ...next, status: 'finished' };
    if (meta.pendingQuiz || next.pending) return next;
    return this.advanceTurnOrKeep(next, currentId);
  }

  private applyDrawCard(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const draw = this.drawCard(meta);
    meta = draw.meta;
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    if (!draw.card) return next;
    const effectText = this.formatCardEffect(draw.card);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} pioche "${draw.card.title}".`,
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

    const answer = toMinuitText(asMinuitRecord(action.payload).answer).trim();
    const correct =
      pending.anyCorrect === true
        ? true
        : (pending.answer ?? '').trim().toLowerCase() === answer.toLowerCase();

    let next: GameStateEntity = state;
    const who = resolvePlayerNameFromState(
      next,
      currentId,
      MINUIT_PLAYER_NAME_OPTIONS,
    );
    if (correct) {
      const delta =
        typeof pending.successDelta === 'number' ? pending.successDelta : 0;
      next = this.core.appendLog(next, `${who} a choisi la bonne réponse !`);
      if (delta > 0) {
        next = this.move(next, currentId, delta);
      }
    } else {
      next = this.core.appendLog(
        next,
        `${who} a validé la mauvaise réponse.`,
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

    const pending = state.pending;
    if (
      !pending ||
      pending.type !== 'choose_target' ||
      pending.playerId !== currentId
    )
      return state;
    const targetPlayerId = Number(
      asMinuitRecord(action.payload).targetPlayerId,
    );
    if (!Number.isFinite(targetPlayerId)) return state;

    let meta = this.getMeta(state);
    const ctx = meta.pendingContext ?? null;
    if (!ctx || ctx.actorId !== currentId) return { ...state, pending: null };

    if (ctx.kind === 'swap' && targetPlayerId === -1) {
      let next: GameStateEntity = {
        ...state,
        pending: null,
        metadata: { ...(state.metadata ?? {}), ...meta, pendingContext: null },
      };
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(
          next,
          currentId,
          MINUIT_PLAYER_NAME_OPTIONS,
        )} refuse l’échange.`,
      );
      return this.advanceTurnOrKeep(next, currentId);
    }
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
        `${resolvePlayerNameFromState(next, currentId, MINUIT_PLAYER_NAME_OPTIONS)} échange sa position avec ${resolvePlayerNameFromState(next, targetPlayerId, MINUIT_PLAYER_NAME_OPTIONS)}.`,
      );
      return this.advanceTurnOrKeep(next, currentId);
    }

    if (ctx.kind === 'gift') {
      let next: GameStateEntity = {
        ...state,
        pending: null,
        metadata: { ...(state.metadata ?? {}), ...meta, pendingContext: null },
      };
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, currentId, MINUIT_PLAYER_NAME_OPTIONS)} offre un cadeau à ${resolvePlayerNameFromState(next, targetPlayerId, MINUIT_PLAYER_NAME_OPTIONS)}.`,
      );
      next = this.move(next, targetPlayerId, 1);
      next = this.move(next, currentId, 2);
      next = this.applyLanding(next, currentId);
      const nextMeta = this.getMeta(next);
      if (nextMeta.pendingQuiz || next.pending) return next;
      return this.advanceTurnOrKeep(next, currentId);
    }

    return { ...state, pending: null };
  }

  private ensurePawnSelection(state: GameStateEntity): GameStateEntity {
    const status = (state.status ?? '').toLowerCase();
    const players = Array.isArray(state.players) ? state.players : [];
    const meta = this.getMeta(state);
    if (players.length < MINUIT_GAME.minPlayers) return state;
    const hasPendingPick = state.pending?.type === 'pick_pawn';
    const needsPawnSelection = players.some(
      (p) => !!p && !this.isBotLike(p, meta) && !this.hasPawnAssigned(p, meta),
    );
    const needsBotPawns = players.some(
      (p) => !!p && this.isBotLike(p, meta) && !this.hasPawnAssigned(p, meta),
    );
    if (status === 'started') {
      // Preserve human pawn-pick chronology in logs:
      // resolve human pending picks first, then auto-assign bot pawns.
      if (needsPawnSelection || hasPendingPick) {
        const queued = this.queuePawnSelection(state);
        if ((queued.pending as PendingPickPawn | null)?.type === 'pick_pawn') {
          return queued;
        }
        if (queued === state) {
          return state;
        }
        return this.ensurePawnSelection(queued);
      }

      const withBots = needsBotPawns ? this.assignBotPawns(state) : state;
      const withBotsPlayers = Array.isArray(withBots.players)
        ? withBots.players
        : [];
      const withBotsMeta = this.getMeta(withBots);
      const stillNeedsBotPawns = withBotsPlayers.some(
        (p) =>
          !!p &&
          this.isBotLike(p, withBotsMeta) &&
          !this.hasPawnAssigned(p, withBotsMeta),
      );
      if (!stillNeedsBotPawns) {
        return this.restoreStarterAfterPawnSelection(withBots);
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
    const pending = state.pending;
    const players = Array.isArray(state.players) ? state.players : [];
    const meta = this.getMeta(state);
    if (pending && pending.type === 'pick_pawn') {
      const pendingPlayerId = Number(pending.playerId);
      const pendingPlayer = players.find(
        (p) => Number(p?.id) === pendingPlayerId,
      );
      if (
        pendingPlayer &&
        !this.isBotLike(pendingPlayer, meta) &&
        !this.hasPawnAssigned(pendingPlayer, meta)
      ) {
        return state;
      }
    }
    const missingHumans = players.filter(
      (p) => !!p && !this.isBotLike(p, meta) && !this.hasPawnAssigned(p, meta),
    );
    if (!missingHumans.length) {
      return pending && pending.type === 'pick_pawn'
        ? { ...state, pending: null }
        : state;
    }
    const choiceEntries = this.listPawnChoiceEntries(this.getMeta(state));
    const queued = queueConfiguredPawnSelection({
      state,
      core: this.core,
      setupFlow: this.setupFlow,
      catalog: choiceEntries.map((entry) => ({
        id: entry.id,
        label: entry.label,
        description: entry.description,
      })),
      startPlayerId: players[0]?.id ?? null,
      pendingType: 'pick_pawn',
      metadataAssignmentKey: 'pawns',
      playerPawnField: 'pawn',
      isBotPlayer: (player, currentState) =>
        this.isBotLike(player, this.getMeta(currentState)),
      includeChoiceMapData: true,
      pawnDataMapper: (choice) => ({
        id: String(choice.id ?? '').trim(),
        label: String(choice.label ?? '').trim(),
        description: String(choice.description ?? '').trim(),
      }),
    });
    return queued.pending ? queued : { ...state, pending: null };
  }

  private assignBotPawns(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    return assignConfiguredBotPawns({
      state,
      core: this.core,
      catalog: this.listPawnChoiceEntries(meta).map((entry) => ({
        id: entry.id,
        label: entry.label,
        description: entry.description,
      })),
      metadataAssignmentKey: 'pawns',
      playerPawnField: 'pawn',
      isBotPlayer: (player, currentState) =>
        this.isBotLike(player, this.getMeta(currentState)),
      playerNameOptions: MINUIT_PLAYER_NAME_OPTIONS,
      logLabelResolver: (choice, currentState) =>
        resolveMinuitPawnName(
          this.getMeta(currentState),
          toMinuitText(choice.id),
        ),
      pickChoice: ({ available, catalog }) =>
        available.length > 0 ? available[0] : (catalog[0] ?? null),
    });
  }

  private handlePickPawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const applied = applyConfiguredPawnSelection({
      state,
      action,
      setupFlow: this.setupFlow,
      core: this.core,
      pendingType: 'pick_pawn',
      metadataCatalogKey: 'pawnChoices',
      metadataAssignmentKey: 'pawns',
      playerPawnField: 'pawn',
      playerNameOptions: MINUIT_PLAYER_NAME_OPTIONS,
      logLabelResolver: (choice, currentState) =>
        resolveMinuitPawnName(
          this.getMeta(currentState),
          toMinuitText(choice.id),
        ),
    });
    return this.ensurePawnSelection(applied?.state ?? state);
  }

  private listPawnChoices(meta: MinuitMetadata): string[] {
    return this.listPawnChoiceEntries(meta).map((entry) => entry.id);
  }

  private listPawnChoiceEntries(
    meta: MinuitMetadata,
  ): Array<{ id: string; label: string; description: string }> {
    const fromContent = Array.isArray(meta.pawnChoices)
      ? meta.pawnChoices
          .map((p) => {
            const pawn = asMinuitRecord(p);
            return {
              id: toMinuitText(pawn.id).trim(),
              name: toMinuitText(pawn.name).trim(),
              description: toMinuitText(pawn.description).trim(),
            };
          })
          .filter((p) => p.id.length > 0 && p.name.length > 0)
          .map((p) => ({
            id: p.id,
            label: p.description ? `${p.name}: ${p.description}` : p.name,
            description: p.description,
          }))
      : [];
    if (fromContent.length) return fromContent;
    return MINUIT_PAWNS.map((name) => ({
      id: name,
      label: name,
      description: '',
    }));
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
      const ai = a ? (a[Number(key)] ?? '') : '';
      const bi = b ? (b[Number(key)] ?? '') : '';
      if (ai !== bi) return false;
    }
    return true;
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    const visitedPositions = new Set<number>();
    for (let step = 0; step < MINUIT_MAX_LANDING_STEPS; step += 1) {
      let meta = this.getMeta(next);
      const pos = this.getPlayerPosition(meta, playerId);
      let tile = meta.tiles[pos] as MinuitTile | undefined;
      if (!tile) return next;

      const occupant = this.findOccupant(meta, playerId, pos);
      if (occupant != null) {
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} place ${describeMinuitPawnPossessive({ state: next, meta, playerId })} sur une case occupée : recul d'une case.`,
        );
        next = this.move(next, playerId, -1);
        meta = this.getMeta(next);
        const afterPos = this.getPlayerPosition(meta, playerId);
        tile = meta.tiles[afterPos] as MinuitTile | undefined;
        if (!tile) return next;
      }

      const afterPos = this.getPlayerPosition(meta, playerId);
      if (visitedPositions.has(afterPos)) {
        return this.core.appendLog(
          next,
          'Enchaînement de cases interrompu pour éviter une boucle infinie.',
        );
      }
      visitedPositions.add(afterPos);
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} place ${describeMinuitPawnPossessive({ state: next, meta, playerId })} en case ${afterPos + 1} (${tile.title}).`,
      );
      const description =
        typeof tile.description === 'string' ? tile.description.trim() : '';
      if (description) {
        next = this.core.appendLog(next, description);
      }
      if (afterPos === 55) {
        meta = { ...meta, winnerId: playerId };
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} atteint Minuit !`,
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
        if (delta === 0) return next;

        const beforePos = afterPos;
        next = this.move(next, playerId, delta);
        const movedMeta = this.getMeta(next);
        const movedPos = this.getPlayerPosition(movedMeta, playerId);
        if (movedPos === beforePos) return next;
        continue;
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

    return this.core.appendLog(
      next,
      'Enchaînement de cases interrompu pour éviter une boucle infinie.',
    );
  }

  private applyCard(
    state: GameStateEntity,
    playerId: number,
    card: MinuitCard,
  ): GameStateEntity {
    return applyMinuitCardEffect({
      state,
      playerId,
      card,
      meta: this.getMeta(state),
      deps: {
        appendLog: (current, message) => this.core.appendLog(current, message),
        otherPlayers: (current, actorId) => this.otherPlayers(current, actorId),
        setPos: (current, actorId, pos) => this.setPos(current, actorId, pos),
        move: (current, actorId, delta) => this.move(current, actorId, delta),
        applyLanding: (current, actorId) => this.applyLanding(current, actorId),
      },
    });
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
    const pos = this.getPlayerPosition(meta, playerId);
    const nextPos = bounceMinuit(pos + delta, 55);
    return this.setPos(state, playerId, nextPos);
  }

  private setPos(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const nextPos = clampMinuit(pos, 0, 55);
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
    const draw = this.deckPolicies.drawFromPile<MinuitCard, MinuitMetadata>({
      meta,
      pile: Array.isArray(meta.decks?.cards) ? meta.decks.cards : [],
      discard: Array.isArray(meta.decks?.discard) ? meta.decks.discard : [],
      useWholeMetaRng: true,
      discardDrawnCard: true,
    });
    return {
      card: draw.card,
      meta: {
        ...draw.meta,
        decks: {
          cards: Array.isArray(draw.pile) ? [...draw.pile] : [],
          discard: Array.isArray(draw.discard) ? [...draw.discard] : [],
        },
      },
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
    const successDelta = extractMinuitMoveDelta(fullText);
    const failureDelta = extractMinuitFailureDelta(fullText);
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
      .map((p) => ({
        id: p.id,
        username: resolvePlayerNameFromState(
          state,
          p.id,
          MINUIT_PLAYER_NAME_OPTIONS,
        ),
      }));
  }

  private findOccupant(
    meta: MinuitMetadata,
    me: number,
    pos: number,
  ): number | null {
    for (const [id, p] of Object.entries(meta.positions ?? {})) {
      const pid = Number(id);
      if (!Number.isFinite(pid) || pid === me) continue;
      if (Number(p ?? 0) === pos) return pid;
    }
    return null;
  }

  private getPlayerPosition(meta: MinuitMetadata, playerId: number): number {
    return clampMinuit(Number(meta.positions?.[playerId] ?? 0), 0, 55);
  }

  private getMeta(state: GameStateEntity): MinuitMetadata {
    return (state.metadata ?? {}) as MinuitMetadata;
  }

  private appendTurnAnnouncement(state: GameStateEntity): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const playerName = this.getTurnPolicies().playerName(state, currentId);
    return this.getPromptPolicies().appendLogOnce(
      state,
      hasRecentPawnSelectionLogs(state.log)
        ? starterTurnAnnouncement(playerName)
        : turnAnnouncement(playerName),
    );
  }

  private getTurnPolicies(): TurnPoliciesService {
    return this.turnPolicies ?? new TurnPoliciesService(this.core);
  }

  private getPromptPolicies(): PromptPoliciesService {
    return this.promptPolicies ?? new PromptPoliciesService(this.core);
  }

  private restoreStarterAfterPawnSelection(
    state: GameStateEntity,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    if (meta.starterRestoredAfterPawnSelection === true) {
      return state;
    }

    const players = Array.isArray(state.players) ? state.players : [];
    const starterIdRaw =
      typeof meta.starterPlayerId === 'number'
        ? meta.starterPlayerId
        : Number(meta.starterPlayerId);
    const starterId = Number.isFinite(starterIdRaw)
      ? Number(starterIdRaw)
      : null;
    if (
      starterId == null ||
      !players.some((p) => Number(p?.id) === starterId)
    ) {
      return {
        ...state,
        metadata: {
          ...(state.metadata ?? {}),
          ...{ ...meta, starterRestoredAfterPawnSelection: true },
        },
      };
    }

    const starterIndex = Math.max(
      0,
      players.findIndex((p) => Number(p?.id) === starterId),
    );
    const currentId = state.turn?.currentPlayerId ?? null;
    const nextMeta: MinuitMetadata = {
      ...meta,
      starterRestoredAfterPawnSelection: true,
    };
    let next: GameStateEntity = {
      ...state,
      turnIndex: starterIndex,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: starterId,
      },
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
    if (currentId !== starterId) {
      next = this.appendTurnAnnouncement(next);
    }
    return next;
  }

  private advanceTurnOrKeep(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
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
    const advanced = this.turns.advanceTurn(state);
    return this.appendTurnAnnouncement(advanced);
  }
}
