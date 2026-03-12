import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { resolvePlayerNameFromState } from '../../../../modules/turn-policies/player-name.helper';

import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import {
  type PawnChoiceOption,
} from '../../../../core/helpers/pawn-choice-action.helper';
import { continueSequentialPawnSelection } from '../../../../core/helpers/sequential-pawn-selection.helper';
import { applyConfiguredPawnSelection } from '../../../../core/helpers/configured-pawn-selection.helper';
import type {
  AFondLesBallonsCard,
  AFondLesBallonsMetadata,
  AFondLesBallonsPendingSwap,
  AFondLesBallonsTile,
} from '../model/a-fond-les-ballons-state.entity';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../actions/action-service.helper';

type AFondRuntimeMetadata = AFondLesBallonsMetadata & {
  aFondKeepTurn?: boolean;
};

@Injectable()
export class AFondLesBallonsActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    _turns: TurnFlowService,
    private readonly deckPolicies: DeckPoliciesService,
    private readonly setupFlow: SetupFlowService,
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
          choose_pawn: () => {
            next = this.handleChoosePawn(next, action);
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
          swap_choose_target: () => {
            next = this.handleSwapChooseTarget(next, action);
            return next;
          },
          swap_decline: () => {
            next = this.handleSwapDecline(next);
            return next;
          },
        },
        () => next,
      );
    });
    return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const meta = this.getMeta(state);
    const rng = this.random.rollDice(meta, 6);
    const roll = rng.roll;

    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...rng.meta },
      lastRoll: roll,
    };

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} lance le dé : "${roll}".`,
    );
    next = this.moveBy(next, currentId, roll, 0);

    const afterMeta = this.getMeta(next);
    if (afterMeta.winnerId != null) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, afterMeta.winnerId)} remporte la partie !`,
      );
      return { ...next, status: 'finished' };
    }

    if (next.pending) return next;

    const keepTurn = this.getMeta(next).aFondKeepTurn === true;
    if (keepTurn) {
      const cleaned = { ...this.getMeta(next) };
      delete cleaned.aFondKeepTurn;
      return { ...next, metadata: cleaned };
    }

    next = this.decrementTrapImmunity(next, currentId);
    return this.advanceTurnWithSkipLogs(next);
  }

  private handleSwapChooseTarget(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;

    const pending = asPendingSwap(state.pending);
    if (!pending || pending.type !== 'swap') return state;

    const currentId = pending.playerId;
    const payload = asRecord(action?.payload);
    const targetPlayerId =
      typeof payload.targetPlayerId === 'number'
        ? payload.targetPlayerId
        : Number(payload.targetPlayerId);
    if (!Number.isFinite(targetPlayerId)) return state;

    const target = (pending.data.targets ?? []).find(
      (t) => t.targetPlayerId === targetPlayerId,
    );
    if (!target) return state;

    let next: GameStateEntity = { ...state, pending: null };
    const meta = this.getMeta(next);
    const positions = { ...(meta.positions ?? {}) };

    const fromPos = positions[currentId] ?? 0;
    const toPos = positions[targetPlayerId] ?? 0;

    positions[currentId] = toPos;
    positions[targetPlayerId] = fromPos;

    next = {
      ...next,
      metadata: { ...(next.metadata ?? {}), ...meta, positions },
    };

    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} échange sa place avec ${resolvePlayerNameFromState(next, targetPlayerId)}.`,
    );

    next = this.decrementTrapImmunity(next, currentId);
    return this.advanceTurnWithSkipLogs(next);
  }

  private handleSwapDecline(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;

    const pending = asPendingSwap(state.pending);
    if (!pending || pending.type !== 'swap') return state;

    const currentId = pending.playerId;
    let next: GameStateEntity = { ...state, pending: null };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, currentId)} refuse l'échange de place.`,
    );

    next = this.decrementTrapImmunity(next, currentId);
    return this.advanceTurnWithSkipLogs(next);
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;

    const pending = asPendingRecord(state.pending);
    if (!pending || pending.type !== 'draw') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : (state.turn?.currentPlayerId ?? null);
    if (!playerId) return state;

    const data = pending?.data ?? {};
    const kind = toText(data.kind);

    let next: GameStateEntity;

    if (kind === 'boutique') {
      const remaining = Math.max(1, Math.abs(Number(data.remaining ?? 1)));
      const drawIndex = Math.max(1, Math.abs(Number(data.drawIndex ?? 1)));
      const depth = Math.max(0, Number(data.depth ?? 0));
      const drawn = Array.isArray(data.drawn)
        ? data.drawn
            .map((entry) => asLoufoqueCard(entry))
            .filter((entry): entry is AFondLesBallonsCard => entry !== null)
        : [];

      next = { ...state, pending: null };
      let meta = this.getMeta(next);
      const draw = this.drawLoufoque(meta);
      meta = draw.meta;
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

      const card = draw.card ?? null;
      if (card) drawn.push(card);
      next = this.core.appendLog(
        next,
        card
          ? `Boutique : carte ${drawIndex} : ${card.text}`
          : `Boutique : carte ${drawIndex} : aucune carte disponible.`,
      );

      const remainingAfter = remaining - 1;
      if (remainingAfter > 0) {
        return {
          ...next,
          pending: {
            type: 'draw',
            playerId,
            blocking: true,
            label: 'Boutique : piocher une carte Loufoque (Espace).',
            data: {
              kind: 'boutique',
              remaining: remainingAfter,
              drawIndex: drawIndex + 1,
              drawn,
              depth,
            },
          },
        };
      }

      const c1 = drawn[0] ?? null;
      const c2 = drawn[1] ?? null;
      const chosen = pickMostReculer(c1, c2);
      if (!chosen) return next;
      next = this.core.appendLog(
        next,
        'Boutique : application de la carte la plus défavorable.',
      );
      next = this.applyCardEffect(next, playerId, chosen, depth);
    } else {
      const cleared: GameStateEntity = { ...state, pending: null };
      next = this.drawAndApplyLoufoque(cleared, playerId, 0);
    }

    if (next.pending) return next;

    const keepTurn = this.getMeta(next).aFondKeepTurn === true;
    if (keepTurn) {
      const cleaned = { ...this.getMeta(next) };
      delete cleaned.aFondKeepTurn;
      return { ...next, metadata: cleaned };
    }

    return this.advanceTurnWithSkipLogs(next);
  }

  private handleChoosePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    const applied = applyConfiguredPawnSelection({
      state,
      action,
      setupFlow: this.setupFlow,
      core: this.core,
      pendingType: 'choose_pawn',
      metadataCatalogKey: 'pawns',
      metadataAssignmentKey: 'pawnByPlayerId',
      choiceCatalogFallback: (options) =>
        options.map((p: PawnChoiceOption) => ({
          id: toText(p.id),
          label: toText(p.label),
          description: toText(p.description),
        })),
      extraMetadataBuilder: ({ metadata, playerId, choice }) => ({
        charactersByPlayerId: {
          ...(asRecord(metadata.charactersByPlayerId) as Record<number, unknown>),
          [playerId]: {
            id: choice.id,
            name: choice.label ?? choice.id,
            description: choice.description ?? '',
          },
        },
      }),
    });
    if (!applied) return state;
    const { playerId } = applied;
    let next = applied.state;
    const nextMeta = this.getMeta(next);

    const playersForPending = Array.isArray(next.players) ? next.players : [];
    const metaForPending = this.getMeta(next);
    const pawnByPlayerIdForPending = metaForPending.pawnByPlayerId ?? {};
    const choicesForPending = this.availablePawns(
      metaForPending,
      pawnByPlayerIdForPending,
    );
    const players = Array.isArray(next.players) ? next.players : [];
    const withTurn = continueSequentialPawnSelection({
      state: next,
      setupFlow: this.setupFlow,
      chooserPlayerId: playerId,
      players: playersForPending,
      isAssigned: (candidateId) =>
        Boolean(pawnByPlayerIdForPending[candidateId]),
      pawns: choicesForPending.map((p) => ({
        id: p.id,
        label: p.label,
        description: p.description,
      })),
      choiceLabelBuilder: (pawn) =>
        toText(pawn.description).length > 0
          ? `${toText(pawn.label)}: ${toText(pawn.description)}`
          : toText(pawn.label),
      pawnDataMapper: (pawn) => ({
        id: toText(pawn.id),
        label: toText(pawn.label),
        description: toText(pawn.description),
      }),
      starterId:
        typeof nextMeta.setupStarterId === 'number'
          ? nextMeta.setupStarterId
          : (state.turn?.currentPlayerId ?? players[0]?.id ?? null),
    });
    if (withTurn.pending) {
      return withTurn;
    }
    return this.appendTurnAnnouncement(withTurn);
  }

  private advanceTurnWithSkipLogs(state: GameStateEntity): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return state;

    const meta = this.getMeta(state);
    const statuses = meta.statuses;
    const skipTurn = statuses.skipTurn;
    const updatedSkip = { ...skipTurn };

    const currentId = state.turn?.currentPlayerId ?? null;
    const currentIndex =
      currentId != null
        ? players.findIndex((p) => p?.id === currentId)
        : state.turnIndex;

    let nextIndex = currentIndex >= 0 ? currentIndex : state.turnIndex;
    let attempts = 0;
    let next = state;

    // We allow up to 2 * players.length attempts to find the next player who can actually play.
    // This handles cases where everyone skips, and we need to come back to the first one whose skip just expired.
    while (attempts < players.length * 2) {
      nextIndex = (nextIndex + 1) % players.length;
      const pid = players[nextIndex]?.id;
      if (typeof pid !== 'number') {
        attempts += 1;
        continue;
      }
      const remaining = updatedSkip[pid] ?? 0;

      if (remaining > 0) {
        updatedSkip[pid] = remaining - 1;
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, pid)} passe son tour.`,
        );
        attempts += 1;
      } else {
        break;
      }
    }

    const finalPlayerId = players[nextIndex]?.id ?? null;

    const advanced: GameStateEntity = {
      ...next,
      turnIndex: nextIndex,
      turn: { currentPlayerId: finalPlayerId, direction: 1 },
      metadata: {
        ...meta,
        statuses: { ...statuses, skipTurn: updatedSkip },
      },
    };
    return this.appendTurnAnnouncement(advanced);
  }

  private appendTurnAnnouncement(state: GameStateEntity): GameStateEntity {
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    return this.core.appendLog(
      state,
      `C'est au tour de ${resolvePlayerNameFromState(state, currentId)}.`,
    );
  }

  private availablePawns(
    meta: AFondLesBallonsMetadata,
    pawnByPlayerId: Record<number, string>,
  ): Array<{ id: string; label: string; description: string }> {
    const pawns = Array.isArray(meta.pawns) ? meta.pawns : [];
    const used = new Set(
      Object.values(pawnByPlayerId).filter((v) => typeof v === 'string'),
    );
    return pawns.filter((p) => !used.has(p.id));
  }

  private moveBy(
    state: GameStateEntity,
    playerId: number,
    delta: number,
    depth: number,
  ): GameStateEntity {
    if (!delta) return state;
    if (depth > 10)
      return this.core.appendLog(state, 'Effet en chaîne interrompu.');

    const meta = this.getMeta(state);
    const current = meta.positions?.[playerId] ?? 0;
    const target = this.computeTarget(current, delta, meta.tiles.length - 1);
    return this.applyLanding(state, playerId, target, depth + 1);
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
    position: number,
    depth: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const tile: AFondLesBallonsTile | undefined = tiles[position];

    meta = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: position },
    };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

    const label = this.compactTileLabel(tile?.label, position);
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} place ${this.pawnLabel(next, playerId)} en case ${position + 1}. (${label}).`,
    );

    if (!tile) return next;

    if (tile.description && String(tile.description).trim().length > 0) {
      next = this.core.appendLog(next, String(tile.description).trim());
    }

    if (tile.type === 'finish') {
      meta = this.getMeta(next);
      meta = { ...meta, winnerId: playerId };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (tile.type === 'bonus') {
      next = this.core.appendLog(next, 'Bonus : avancez de 2 cases.');
      return this.moveBy(next, playerId, 2, depth);
    }

    if (tile.type === 'piege') {
      if (this.hasTrapImmunity(next, playerId)) {
        return this.core.appendLog(next, 'Piège ignoré.');
      }
      next = this.core.appendLog(next, 'Piège : reculez de 2 cases.');
      return this.moveBy(next, playerId, -2, depth);
    }

    if (tile.type === 'glissade') {
      const metaNow = this.getMeta(next);
      const magOut = this.random.nextInt(metaNow, 3);
      const dirOut = this.random.nextInt(magOut.meta, 2);
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), ...dirOut.meta },
      };
      const mag = magOut.value + 1;
      const isForward = dirOut.value % 2 === 0;
      const delta = isForward ? mag : -mag;
      next = this.core.appendLog(
        next,
        `Glissade : ${delta > 0 ? 'avancez' : 'reculez'} de ${Math.abs(delta)} case(s).`,
      );
      return this.moveBy(next, playerId, delta, depth);
    }

    if (tile.type === 'tornade') {
      return this.startSwapPending(
        next,
        playerId,
        'Tornade : choisissez un joueur à échanger dans la liste, puis Entrée.',
      );
    }

    if (tile.type === 'chaton') {
      next = this.core.appendLog(next, 'Chaton : retour à la case départ.');
      return this.applyLanding(next, playerId, 0, depth + 1);
    }

    if (tile.type === 'folie') {
      return {
        ...next,
        pending: {
          type: 'draw',
          playerId,
          blocking: true,
          label: 'Piocher une carte Loufoque (Espace).',
        },
      };
    }

    return next;
  }

  private drawAndApplyLoufoque(
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const draw = this.drawLoufoque(meta);
    meta = draw.meta;
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

    const card = draw.card;
    if (!card)
      return this.core.appendLog(next, 'Aucune carte Loufoque disponible.');

    next = this.core.appendLog(next, `Carte Loufoque : ${card.text}`);
    return this.applyCardEffect(next, playerId, card, depth);
  }

  private applyCardEffect(
    state: GameStateEntity,
    playerId: number,
    card: AFondLesBallonsCard,
    depth: number,
  ): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);
    const roll = typeof next.lastRoll === 'number' ? next.lastRoll : 0;

    switch (card.id) {
      case 1:
        return this.moveBy(next, playerId, -2, depth);
      case 2:
        return this.skipTurns(next, playerId, 1);
      case 3:
        return this.moveBy(next, playerId, 1, depth);
      case 4:
        next = this.core.appendLog(
          next,
          'La partie est figée : tous les joueurs passent un tour.',
        );
        for (const p of next.players ?? []) {
          next = this.core.appendLog(
            next,
            `${resolvePlayerNameFromState(next, p.id)} passera son prochain tour.`,
          );
          next = this.skipTurns(next, p.id, 1);
        }
        return next;
      case 5:
        return this.moveBy(next, playerId, 4, depth);
      case 6:
        for (const p of next.players ?? []) {
          next = this.moveBy(next, p.id, -1, depth);
        }
        return next;
      case 7:
        return this.moveBy(next, playerId, 2, depth);
      case 8:
        return this.moveBy(next, playerId, -1, depth);
      case 9:
        return this.skipTurns(next, playerId, 1);
      case 10:
        return this.moveToNextType(next, playerId, 'bonus', depth);
      case 11:
        return this.skipTurns(next, playerId, 1);
      case 12:
        return this.moveBy(next, playerId, -1, depth);
      case 13:
        return this.moveBy(next, playerId, 2, depth);
      case 14:
        return this.moveBy(next, playerId, 3, depth);
      case 15:
        return this.moveBy(next, playerId, -1, depth);
      case 16:
        return this.moveToNextType(next, playerId, 'folie', depth);
      case 17:
        return this.skipTurns(next, playerId, 1);
      case 18:
        return this.moveBy(next, playerId, 2, depth);
      case 19:
        return this.moveBy(next, playerId, 1, depth);
      case 20:
        return this.skipTurns(next, playerId, 1);
      case 21:
        for (const p of next.players ?? []) {
          next = this.moveBy(next, p.id, 1, depth);
        }
        return next;
      case 22:
        return this.skipTurns(next, playerId, 2);
      case 23:
        return this.moveBy(next, playerId, 4, depth);
      case 24:
        return this.skipTurns(next, playerId, 1);
      case 25:
        return {
          ...next,
          metadata: { ...(next.metadata ?? {}), ...meta, aFondKeepTurn: true },
        };
      case 26:
        if (roll > 0) {
          for (const p of next.players ?? []) {
            next = this.moveBy(next, p.id, roll, depth);
          }
        }
        return next;
      case 27:
        // Combined move to avoid intermediate landing effects (like Bonus loops)
        return this.moveBy(next, playerId, -1, depth);
      case 28:
        return this.startSwapPending(
          next,
          playerId,
          'Échange : choisissez un joueur à échanger dans la liste, puis Entrée.',
        );
      case 29:
        return this.applyLanding(next, playerId, 12, depth + 1);
      case 30:
        return this.skipTurns(next, playerId, 1);
      case 31:
        return this.moveBy(next, playerId, 1, depth);
      case 32:
        return this.moveBy(next, playerId, 2, depth);
      case 33:
        return this.moveBy(next, playerId, 3, depth);
      case 34:
        return this.applyBoutiqueWorstCard(next, playerId, depth);
      case 35:
        return this.applyLanding(next, playerId, 0, depth + 1);
      case 36:
        return this.grantTrapImmunity(next, playerId, 2);
      case 37:
        return this.moveBy(next, playerId, -5, depth);
      case 38:
        for (const p of next.players ?? []) {
          const m1 = this.random.nextInt(this.getMeta(next), 2);
          next = {
            ...next,
            metadata: { ...(next.metadata ?? {}), ...m1.meta },
          };
          const delta = m1.value % 2 === 0 ? 1 : -1;
          next = this.moveBy(next, p.id, delta, depth);
        }
        return next;
      case 39:
        return this.moveBy(next, playerId, 2, depth);
      case 40: {
        const pos = (this.getMeta(next).positions ?? {})[playerId] ?? 0;
        const tile = (this.getMeta(next).tiles ?? [])[pos];
        if (tile?.type === 'glissade') {
          return this.applyLanding(
            next,
            playerId,
            (this.getMeta(next).tiles.length ?? 40) - 1,
            depth + 1,
          );
        }
        return next;
      }
      default:
        return next;
    }
  }

  private applyBoutiqueWorstCard(
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ): GameStateEntity {
    if (state.pending) return state;
    return {
      ...state,
      pending: {
        type: 'draw',
        playerId,
        blocking: true,
        label: 'Boutique : piocher une carte Loufoque (Espace).',
        data: {
          kind: 'boutique',
          remaining: 2,
          drawIndex: 1,
          drawn: [],
          depth,
        },
      },
    };
  }

  private startSwapPending(
    state: GameStateEntity,
    playerId: number,
    label: string,
  ): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const targets = players
      .filter((p) => p?.id !== playerId)
      .map((p) => ({
        targetPlayerId: p.id,
        targetUsername: p.username ?? `Joueur ${p.id}`,
      }));
    if (!targets.length) {
      return this.core.appendLog(
        state,
        'Aucun joueur disponible pour un échange de place.',
      );
    }
    const pending: AFondLesBallonsPendingSwap = {
      type: 'swap',
      label,
      playerId,
      blocking: true,
      choices: [...targets.map((t) => t.targetUsername), 'Ne pas échanger'],
      data: { targets },
    };
    return { ...state, pending };
  }

  private moveToNextType(
    state: GameStateEntity,
    playerId: number,
    type: AFondLesBallonsTile['type'],
    depth: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const current = meta.positions?.[playerId] ?? 0;
    const idx = tiles.findIndex((t, i) => i > current && t?.type === type);
    if (idx < 0) {
      return this.core.appendLog(
        state,
        `Aucune case de type ${type} n'a été trouvée devant vous.`,
      );
    }
    return this.applyLanding(state, playerId, idx, depth + 1);
  }

  private skipTurns(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const statuses = meta.statuses;
    const current = statuses.skipTurn?.[playerId] ?? 0;
    return {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        statuses: {
          ...statuses,
          skipTurn: {
            ...(statuses.skipTurn ?? {}),
            [playerId]: current + turns,
          },
        },
      },
    };
  }

  private grantTrapImmunity(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const statuses = meta.statuses;
    const current = statuses.trapImmunityTurns?.[playerId] ?? 0;
    return {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        statuses: {
          ...statuses,
          trapImmunityTurns: {
            ...(statuses.trapImmunityTurns ?? {}),
            [playerId]: current + turns,
          },
        },
      },
    };
  }

  private hasTrapImmunity(state: GameStateEntity, playerId: number): boolean {
    const meta = this.getMeta(state);
    const turns = meta?.statuses?.trapImmunityTurns?.[playerId] ?? 0;
    return Number(turns) > 0;
  }

  private decrementTrapImmunity(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const statuses = meta.statuses;
    const current = Number(statuses.trapImmunityTurns?.[playerId] ?? 0);
    if (!Number.isFinite(current) || current <= 0) return state;
    const nextValue = current - 1;
    return {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        statuses: {
          ...statuses,
          trapImmunityTurns: {
            ...(statuses.trapImmunityTurns ?? {}),
            [playerId]: nextValue,
          },
        },
      },
    };
  }

  private drawLoufoque(meta: AFondLesBallonsMetadata): {
    card: AFondLesBallonsCard | null;
    meta: AFondLesBallonsMetadata;
  } {
    const decks = meta.decks;
    const pile: AFondLesBallonsCard[] = [...(decks.loufoque ?? [])];
    const discard: AFondLesBallonsCard[] = [...(decks.discardLoufoque ?? [])];
    const defaults = defaultLoufoqueDeck();
    const draw = this.deckPolicies.drawFromPile<
      AFondLesBallonsCard,
      AFondLesBallonsMetadata
    >({
      meta,
      pile,
      discard: pile.length ? discard : defaults,
      useWholeMetaRng: true,
      discardDrawnCard: true,
    });

    return {
      card: draw.card,
      meta: {
        ...draw.meta,
        decks: {
          ...decks,
          loufoque: draw.pile,
          discardLoufoque: draw.discard,
        },
      },
    };
  }

  private computeTarget(
    current: number,
    delta: number,
    finalIndex: number,
  ): number {
    let value = current + delta;
    if (value < 0) return 0;
    while (value > finalIndex) {
      const overshoot = value - finalIndex;
      value = finalIndex - overshoot;
      if (value < 0) return 0;
    }
    return value;
  }

  private getMeta(state: GameStateEntity): AFondRuntimeMetadata {
    return normalizeAFondMeta(state.metadata);
  }

  private pawnLabel(state: GameStateEntity, id: number): string {
    const meta = this.getMeta(state);
    const pawnId = toText(meta.pawnByPlayerId?.[id]);
    const pawn = Array.isArray(meta?.pawns)
      ? meta.pawns.find((p) => toText(p?.id) === pawnId)
      : null;
    const title = toText(pawn?.label);
    if (title) return `"${title}"`;
    return 'un pion';
  }

  private compactTileLabel(
    rawLabel: string | undefined,
    position: number,
  ): string {
    const fallback = `Case ${position + 1}`;
    const value = String(rawLabel ?? fallback).trim();
    if (!value) {
      return fallback;
    }
    return value.replace(/^Case\s+\d+\s*-\s*/i, '').trim() || fallback;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

function normalizeAFondMeta(input: unknown): AFondRuntimeMetadata {
  const raw = asRecord(input);
  return {
    rng: asRecord(raw.rng),
    tiles: (Array.isArray(raw.tiles) ? raw.tiles : []) as AFondLesBallonsTile[],
    positions: asRecord(raw.positions) as Record<number, number>,
    pawns: (Array.isArray(raw.pawns)
      ? raw.pawns
      : []) as AFondLesBallonsMetadata['pawns'],
    pawnByPlayerId:
      (asRecord(raw.pawnByPlayerId) as Record<number, string>) ?? {},
    setupStarterId:
      typeof raw.setupStarterId === 'number' ? raw.setupStarterId : null,
    charactersByPlayerId:
      (asRecord(
        raw.charactersByPlayerId,
      ) as AFondLesBallonsMetadata['charactersByPlayerId']) ?? {},
    statuses: {
      skipTurn:
        (asRecord(asRecord(raw.statuses).skipTurn) as Record<number, number>) ??
        {},
      trapImmunityTurns:
        (asRecord(asRecord(raw.statuses).trapImmunityTurns) as Record<
          number,
          number
        >) ?? {},
    },
    decks: {
      loufoque: (Array.isArray(asRecord(raw.decks).loufoque)
        ? asRecord(raw.decks).loufoque
        : []) as AFondLesBallonsCard[],
      discardLoufoque: (Array.isArray(asRecord(raw.decks).discardLoufoque)
        ? asRecord(raw.decks).discardLoufoque
        : []) as AFondLesBallonsCard[],
    },
    winnerId: typeof raw.winnerId === 'number' ? raw.winnerId : null,
    aFondKeepTurn: raw.aFondKeepTurn === true,
  };
}

function asPendingRecord(value: unknown): {
  type?: string;
  playerId?: unknown;
  data?: Record<string, unknown>;
} | null {
  if (!value || typeof value !== 'object') return null;
  const record = asRecord(value);
  return {
    type: toText(record.type),
    playerId: record.playerId,
    data: asRecord(record.data),
  };
}

function asPendingSwap(value: unknown): AFondLesBallonsPendingSwap | null {
  if (!value || typeof value !== 'object') return null;
  const record = asRecord(value);
  if (toText(record.type) !== 'swap') return null;
  const playerId = Number(record.playerId);
  if (!Number.isFinite(playerId)) return null;
  const data = asRecord(record.data);
  const targets = Array.isArray(data.targets)
    ? data.targets
        .map((entry) => {
          const out = asRecord(entry);
          const targetPlayerId = Number(out.targetPlayerId);
          const targetUsername = toText(out.targetUsername);
          if (!Number.isFinite(targetPlayerId) || !targetUsername) return null;
          return { targetPlayerId, targetUsername };
        })
        .filter(
          (
            entry,
          ): entry is { targetPlayerId: number; targetUsername: string } =>
            entry !== null,
        )
    : [];
  return {
    type: 'swap',
    label: toText(record.label),
    playerId,
    blocking: true,
    choices: (Array.isArray(record.choices) ? record.choices : [])
      .map((entry) => toText(entry))
      .filter((entry) => entry.length > 0),
    data: { targets },
  };
}

function asLoufoqueCard(value: unknown): AFondLesBallonsCard | null {
  if (!value || typeof value !== 'object') return null;
  const record = asRecord(value);
  const id = Number(record.id);
  const text = toText(record.text);
  if (!Number.isFinite(id) || !text) return null;
  return { id, text };
}

function pickMostReculer(
  a: AFondLesBallonsCard | null,
  b: AFondLesBallonsCard | null,
): AFondLesBallonsCard | null {
  const score = (c: AFondLesBallonsCard | null): number => {
    if (!c) return Number.POSITIVE_INFINITY;
    if (c.id === 37) return -5;
    if (c.id === 29) return -100;
    if (c.id === 35) return -200;
    if (c.id === 1) return -2;
    if (c.id === 6 || c.id === 8 || c.id === 12 || c.id === 15) return -1;
    if (c.id === 27) return -1;
    return 0;
  };
  const sa = score(a);
  const sb = score(b);
  if (sa === Number.POSITIVE_INFINITY && sb === Number.POSITIVE_INFINITY)
    return null;
  return sa <= sb ? a : b;
}

function defaultLoufoqueDeck(): AFondLesBallonsCard[] {
  return [
    {
      id: 1,
      text: 'Vous glissez sur une peau de banane séchée. Reculez de 2 cases.',
    },
    {
      id: 2,
      text: 'Un muscardin vous livre un cookie géant, beaucoup trop lourd. Passez votre tour.',
    },
    {
      id: 3,
      text: "Vous sautez dans une flaque de confiture collante. Avancez d'une case.",
    },
    {
      id: 4,
      text: "Une noix étrange chante et perturbe la tanière. La partie est figée : aucun joueur n'agit pendant ce tour.",
    },
    {
      id: 5,
      text: 'Un écureuil volant vous prend pour un ami et vous emporte dans les airs. Avancez de 4 cases.',
    },
    {
      id: 6,
      text: "Vous renversez une bouteille de sirop magique. Tous les joueurs reculent d'une case.",
    },
    {
      id: 7,
      text: 'Vous trouvez une corde à sauter en réglisse enchantée. Avancez de 2 cases.',
    },
    { id: 8, text: "Le Grand Chaton éternue violemment. Reculez d'une case." },
    {
      id: 9,
      text: 'Vous vous prenez les pattes dans du chewing-gum collant. Passez votre tour.',
    },
    {
      id: 10,
      text: "Un lérot ninja surgit et vous tend une noisette turbo. Avancez jusqu'à la prochaine case Bonus.",
    },
    {
      id: 11,
      text: 'Vous mangez trop de pop-corn et avez mal au ventre. Passez votre tour.',
    },
    {
      id: 12,
      text: "Votre museau vous démange sans raison. Reculez d'une case.",
    },
    {
      id: 13,
      text: "Une gerboise farceuse vous chatouille les pattes. Sautez d'une case.",
    },
    {
      id: 14,
      text: 'Vous chevauchez un ragondin en trottinette. Avancez de 3 cases.',
    },
    {
      id: 15,
      text: "Vous faites tomber une montagne de cacahuètes. Distrait, vous reculez d'une case.",
    },
    {
      id: 16,
      text: "Une bulle de savon géante vous emporte. Avancez jusqu'à la prochaine case Folie.",
    },
    {
      id: 17,
      text: 'Un capybara vous invite à une sieste improvisée. Passez votre tour et ronflez à ses côtés.',
    },
    {
      id: 18,
      text: 'Une souris malicieuse vous pique une noisette et file à toute vitesse. Vous la poursuivez et avancez de 2 cases.',
    },
    {
      id: 19,
      text: "Un loir vous montre le chemin en remuant la queue. Avancez d'une case en souriant.",
    },
    {
      id: 20,
      text: 'Vous confondez une chaussette avec un bonnet, et ne voyez plus rien. Passez votre tour.',
    },
    {
      id: 21,
      text: "Vous renversez un pot de peinture fluo. Tout le monde avance d'une case.",
    },
    {
      id: 22,
      text: 'Une baguette magique vous transforme temporairement en fromage. Passez deux tours.',
    },
    { id: 23, text: 'Vous trouvez un trampoline géant. Avancez de 4 cases.' },
    {
      id: 24,
      text: 'Un agouti philosophe vous parle longuement. Passez votre tour.',
    },
    {
      id: 25,
      text: 'Vous construisez une solide cabane en biscuits. Rejouez.',
    },
    {
      id: 26,
      text: 'Vous éternuez des confettis multicolores. Tous les joueurs avancent du même nombre de cases obtenu précédemment.',
    },
    {
      id: 27,
      text: "Un petit avion de carton vous emporte maladroitement. Avancez d'une case, puis reculez de deux.",
    },
    {
      id: 28,
      text: 'Vous lisez un vieux grimoire ronronique. Échangez votre position avec le joueur de votre choix.',
    },
    {
      id: 29,
      text: 'Une catapulte de fromage rebondit sur vous. Allez en case 13.',
    },
    {
      id: 30,
      text: "Vous tombez dans une mare d'épaisse mousse. Passez votre tour.",
    },
    {
      id: 31,
      text: "Un hutia curieux bondit sur votre chemin et vous bouscule gentiment. Avancez d'une case un peu étourdi.",
    },
    {
      id: 32,
      text: 'Un fromage qui parle vous raconte une irrésistible blague. Avancez de 2 cases.',
    },
    {
      id: 33,
      text: 'Vous jouez à saute-rongeur avec un paca. Avancez de 3 cases.',
    },
    {
      id: 34,
      text: 'Vous entrez dans la Boutique des Rongeurs Fous. Piochez deux cartes Loufoques et appliquez celle qui vous fait le plus reculer.',
    },
    {
      id: 35,
      text: 'Un tunnel défectueux vous mène droit chez le Chaton gourmand. Retournez à la case départ.',
    },
    {
      id: 36,
      text: 'Vous devenez temporairement invisible. Durant deux tours, vous ignorez les effets des cases Piège.',
    },
    {
      id: 37,
      text: 'Vous mangez un piment super piquant. Reculez de 5 cases.',
    },
    {
      id: 38,
      text: "Un biscuit géant explose. Tous les joueurs se déplacent d'une case aléatoire.",
    },
    {
      id: 39,
      text: 'Une pluie de bonbons tombe sur vous. Avancez de 2 cases.',
    },
    {
      id: 40,
      text: "La Reine des Rongeurs vous envoie un message. Si vous êtes sur une case Glissade, avancez jusqu'à la case 40.",
    },
  ];
}
