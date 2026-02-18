import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';


import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { BoardEffectsPoliciesService } from '../../../../modules/board-effects-policies/services/board-effects-policies.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import type {
  AventureSauvageCard,
  AventureSauvageMetadata,
  AventureSauvageTile,
} from '../model/aventure-sauvage-state.entity';
import { applyActionsSequentially, dispatchByActionType, normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';



@Injectable()
export class AventureSauvageActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    private readonly setupFlow: SetupFlowService,
    private readonly boardEffects: BoardEffectsPoliciesService,
    private readonly deckPolicies: DeckPoliciesService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    const next = applyActionsSequentially(this.ensurePawnSelectionPrompt(state), actions, (next, action) => {
          const type = normalizeActionType(action);
          return dispatchByActionType(
            type,
            {
              'choose_pawn': () => {
                next = this.handleChoosePawn(next, action);
            next = this.ensurePawnSelectionPrompt(next);
                return next;
              },
              'roll': () => {
                next = this.handleRoll(next);
                return next;
              },
              'ROLL_DICE': () => {
                next = this.handleRoll(next);
                return next;
              },
              'roll_dice': () => {
                next = this.handleRoll(next);
                return next;
              },
              'draw': () => {
                next = this.handleDraw(next);
                return next;
              },
            },
            () => next,
          );
        });
        return this.ensurePawnSelectionPrompt(next);
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const autoSkipped = this.autoSkipIfNeeded(state);
    if (autoSkipped !== state) return autoSkipped;

    const meta = this.getMeta(state);
    const rng = this.random.rollDice(meta as any, 6);
    const roll = rng.roll;

    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...rng.meta },
      lastRoll: roll,
    };

    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} lance le de : "${roll}".`,
    );

    const currentPos = meta.positions?.[currentId] ?? 0;
    const target = this.clampMove(currentPos + roll, meta.tiles.length);
    next = this.applyLanding(next, currentId, target);
    if (next.pending) return next;

    const afterMeta = this.getMeta(next);
    if (afterMeta.winnerId != null) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, afterMeta.winnerId)} remporte la partie !`,
      );
      return { ...next, status: 'finished' };
    }

    return this.advanceTurn(next);
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;

    const pending = state.pending as any;
    if (!pending || pending.type !== 'draw') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (!playerId) return state;

    const deckRaw = String(pending?.data?.deck ?? '').trim().toLowerCase();
    const deck = deckRaw === 'patte' ? 'patte' : 'animal';

    const cleared: GameStateEntity = { ...state, pending: null };
    let next = this.drawAndApplyCard(cleared, playerId, deck);

    const reroll = Boolean((next.metadata as any)?.aventureReroll);
    if (reroll) {
      const cleaned = { ...(next.metadata ?? {}) } as any;
      delete cleaned.aventureReroll;
      next = { ...next, metadata: cleaned };
    }

    if (next.pending) return next;

    const afterMeta = this.getMeta(next);
    if (afterMeta.winnerId != null) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, afterMeta.winnerId)} remporte la partie !`,
      );
      return { ...next, status: 'finished' };
    }

    if (reroll) {
      return next;
    }

    return this.advanceTurn(next);
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

    const payload = (action?.payload ?? {}) as any;
    const rawPawn = payload.pawnId ?? payload.pawn ?? payload.value ?? null;
    const options = Array.isArray(pending?.data?.pawns) ? pending.data.pawns : [];
    const chosen = this.resolvePendingPawn(rawPawn, options);
    if (!chosen) return state;

    const meta = this.getMeta(state);
    const assigned = { ...(meta.pawnByPlayerId ?? {}) } as Record<number, string>;
    if (assigned[playerId]) return state;
    if (Object.values(assigned).some((id) => id === chosen.id)) return state;

    const nextMeta: AventureSauvageMetadata = {
      ...meta,
      pawns:
        Array.isArray(meta.pawns) && meta.pawns.length > 0
          ? meta.pawns
          : options.map((p: any) => ({
              id: String(p?.id ?? '').trim(),
              label: String(p?.label ?? p?.title ?? '').trim(),
              description: String(p?.description ?? '').trim(),
            })),
      pawnByPlayerId: { ...assigned, [playerId]: chosen.id },
    };

    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };

    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} choisit le pion : ${String(chosen.label ?? 'pion').trim()}.`,
    );

    const pendingInfo = this.buildPawnPending(next, playerId);
    if (pendingInfo) {
      const withPending: GameStateEntity = {
        ...next,
        pending: pendingInfo.pending,
        turnIndex: pendingInfo.turnIndex,
        turn: { ...(next.turn ?? { direction: 1 }), currentPlayerId: pendingInfo.playerId, direction: 1 },
      };
      return this.ensurePawnSelectionPrompt(withPending);
    }

    const players = Array.isArray(next.players) ? next.players : [];
    const starterId =
      typeof nextMeta.setupStarterId === 'number'
        ? nextMeta.setupStarterId
        : (state.turn?.currentPlayerId ?? players[0]?.id ?? null);
    const starterIndex =
      starterId != null ? players.findIndex((p) => p?.id === starterId) : -1;
    const resolvedStarterId =
      starterId != null && starterIndex >= 0
        ? starterId
        : players[0]?.id ?? null;

    const started: GameStateEntity = {
      ...next,
      pending: null,
      turnIndex: starterIndex >= 0 ? starterIndex : next.turnIndex,
      turn: { ...(next.turn ?? { direction: 1 }), currentPlayerId: resolvedStarterId, direction: 1 },
    };
    const starterName = this.playerName(started, resolvedStarterId ?? players[0]?.id ?? 0);
    let withLogs = this.core.appendLog(started, `Debut de partie : ${starterName} commence.`);
    withLogs = this.appendTurnAnnouncement(withLogs, resolvedStarterId);
    return withLogs;
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
    position: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const tile: AventureSauvageTile | undefined = tiles[position];

    meta = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: position },
    };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

    const label = this.boardEffects.formatTileLabel(position, tile?.label ?? '');
    next = this.core.appendLog(
      next,
      this.boardEffects.createPlacementLog({
        playerLabel: this.playerName(next, playerId),
        pawnLabel: this.pawnPossessiveLabel(next, playerId),
        position,
        tileLabel: label,
      }),
    );

    if (!tile) return next;

    const landing = this.boardEffects.resolveLanding({
      position,
      playerId,
      tile: { type: tile.type, description: tile.description },
      drawPolicies: {
        animal: {
          log: 'Piochez une carte Animal rigolo.',
          pendingLabel: 'Piocher une carte Animal rigolo (Espace).',
          data: { deck: 'animal' },
        },
        patte: {
          log: 'Piochez une carte Coup de patte.',
          pendingLabel: 'Piocher une carte Coup de patte (Espace).',
          data: { deck: 'patte' },
        },
      },
      finishTypes: ['finish'],
    });
    for (const line of landing.logs) {
      if (line.trim().length > 0) {
        next = this.core.appendLog(next, line);
      }
    }

    if (landing.isFinish) {
      meta = this.getMeta(next);
      meta = { ...meta, winnerId: playerId };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (landing.pending) return { ...next, pending: landing.pending };

    return next;
  }

  private drawAndApplyCard(
    state: GameStateEntity,
    playerId: number,
    deck: 'animal' | 'patte',
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const draw = this.drawCard(meta, deck);
    meta = draw.meta;

    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    const card = draw.card;
    if (!card) {
      return this.core.appendLog(next, `Aucune carte disponible (${deck}).`);
    }

    const prefix =
      deck === 'animal' ? 'Carte Animal rigolo' : 'Carte Coup de patte';
    next = this.core.appendLog(next, `${prefix} : ${card.text}`);

    // Cas special carte 17 (animal) : -1 puis +1 (net 0)
    if (card.id === 17 && deck === 'animal') {
      next = this.moveBy(next, playerId, -1);
      next = this.moveBy(next, playerId, +1);
      return next;
    }

    if (typeof card.moveDelta === 'number' && card.moveDelta !== 0) {
      next = this.moveBy(next, playerId, card.moveDelta);
    }

    if (card.skipTurns && card.skipTurns > 0) {
      next = this.addSkipTurns(next, playerId, card.skipTurns);
    }

    if (card.reroll) {
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), aventureReroll: true },
      };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} rejoue.`,
      );
    }

    return next;
  }

  private buildPawnPending(
    state: GameStateEntity,
    startId: number | null,
  ): { pending: any; playerId: number; turnIndex: number } | null {
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return null;

    const meta = this.getMeta(state);
    const pawnByPlayerId = (meta.pawnByPlayerId ?? {}) as Record<number, string>;
    const choices = this.availablePawns(meta, pawnByPlayerId);
    return this.setupFlow.createSequentialChoicePending({
      players,
      startPlayerId: startId,
      isAssigned: (playerId) => Boolean(pawnByPlayerId[playerId]),
      pendingType: 'choose_pawn',
      choices: choices.map((p) => ({
        id: p.id,
        label:
          p.description && String(p.description).trim().length > 0
            ? `${p.label}: ${p.description}`
            : p.label,
        title: p.label,
        description: p.description,
      })),
      labelForPlayer: (playerLabel) => `C'est à ${playerLabel} de choisir son pion.`,
      dataBuilder: (availableChoices) => ({
        pawns: availableChoices.map((p: any) => ({
          id: String(p?.id ?? '').trim(),
          label: String(p?.title ?? p?.label ?? '').trim(),
          description: String(p?.description ?? '').trim(),
        })),
      }),
    });
  }

  private availablePawns(
    meta: AventureSauvageMetadata,
    pawnByPlayerId: Record<number, string>,
  ): Array<{ id: string; label: string; description: string }> {
    const pawns = Array.isArray(meta.pawns) ? meta.pawns : [];
    const used = new Set(
      Object.values(pawnByPlayerId).filter((v) => typeof v === 'string'),
    );
    return pawns.filter((p) => !used.has(p.id));
  }
  private resolvePendingPawn(
    raw: unknown,
    options: Array<{ id?: string; label?: string; title?: string }>,
  ): { id: string; label: string; description: string } | null {
    const normalized = (Array.isArray(options) ? options : [])
      .map((p: any) => ({
        id: String(p?.id ?? '').trim(),
        label: String(p?.label ?? p?.title ?? '').trim(),
        description: String(p?.description ?? '').trim(),
      }))
      .filter((p) => p.id.length > 0 && p.label.length > 0);
    if (!normalized.length) return null;
    return this.setupFlow.resolveChoice(raw, normalized) as
      | { id: string; label: string; description: string }
      | null;
  }

  private moveBy(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    if (!delta) return state;
    const meta = this.getMeta(state);
    const current = meta.positions?.[playerId] ?? 0;
    const nextPos = this.clampMove(current + delta, meta.tiles.length);
    return this.applyLanding(state, playerId, nextPos);
  }

  private addSkipTurns(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const meta = this.getMeta(state) as any;
    const statuses = meta.statuses ?? { skipTurn: {} };
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

  private drawCard(
    meta: AventureSauvageMetadata,
    deck: 'animal' | 'patte',
  ): { card: AventureSauvageCard | null; meta: AventureSauvageMetadata } {
    const decks = meta.decks ?? ({} as any);
    const drawPile: AventureSauvageCard[] = [...(decks[deck] ?? [])];
    const discardKey = deck === 'animal' ? 'discardAnimal' : 'discardPatte';
    const discardPile: AventureSauvageCard[] = [...(decks[discardKey] ?? [])];
    const defaults = deck === 'animal' ? defaultAnimalDeck() : defaultPatteDeck();
    const draw = this.deckPolicies.drawFromPile<
      AventureSauvageCard,
      AventureSauvageMetadata
    >({
      meta,
      pile: drawPile,
      discard: discardPile.length ? discardPile : defaults,
      useWholeMetaRng: true,
      discardDrawnCard: true,
    });

    const nextDecks = {
      ...decks,
      [deck]: draw.pile,
      [discardKey]: draw.discard,
    };
    return { card: draw.card, meta: { ...draw.meta, decks: nextDecks } };
  }

  private clampMove(value: number, tilesLen: number): number {
    const max = Math.max(1, tilesLen) - 1;
    if (value <= 0) return 0;
    if (value >= max) return max;
    return value;
  }

  private getMeta(state: GameStateEntity): AventureSauvageMetadata {
    return (state.metadata ?? {}) as any as AventureSauvageMetadata;
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
    const meta = this.getMeta(state);
    const pawnId = String(meta?.pawnByPlayerId?.[id] ?? '').trim();
    const pawn = Array.isArray(meta?.pawns)
      ? meta.pawns.find((p: any) => String(p?.id ?? '').trim() === pawnId)
      : null;
    const title = String(pawn?.label ?? '').trim();
    if (title) return `"${title}"`;
    return 'un pion';
  }

  private pawnPossessiveLabel(state: GameStateEntity, id: number): string {
    const raw = this.pawnLabel(state, id);
    const inner = String(raw ?? '').trim().replace(/^"(.*)"$/, '$1').trim();
    if (!inner) return '"son pion"';
    const stripped = inner
      .replace(/^(le|la|les|un|une)\s+/i, '')
      .replace(/^l['â€™]\s*/i, '')
      .trim();
    const base = this.lowercaseFirst(stripped || inner);
    const feminine = /^(la|une)\s+/i.test(inner);
    const possessive = feminine ? 'sa' : 'son';
    return `"${possessive} ${base}"`;
  }

  private lowercaseFirst(value: string): string {
    const text = String(value ?? '').trim();
    if (!text) return text;
    if (text.length === 1) return text.toLowerCase();
    return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  }

  private appendTurnAnnouncement(
    state: GameStateEntity,
    playerId: number | null | undefined,
  ): GameStateEntity {
    if (typeof playerId !== 'number' || !Number.isFinite(playerId)) {
      return state;
    }
    return this.core.appendLog(state, `C'est au tour de ${this.playerName(state, playerId)}.`);
  }

  private ensurePawnSelectionPrompt(state: GameStateEntity): GameStateEntity {
    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_pawn') return state;
    const chooserId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (chooserId == null) return state;
    return state;
  }

  private appendLogOnce(state: GameStateEntity, message: string): GameStateEntity {
    const log = Array.isArray(state.log) ? state.log : [];
    const last = String(log[log.length - 1]?.message ?? '').trim();
    if (last === message) return state;
    return this.core.appendLog(state, message);
  }

  private advanceTurn(state: GameStateEntity): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return state;

    const meta: any = state.metadata ?? {};
    const statuses: any = meta.statuses ?? {};
    const baseSkipTurn: Record<number, number> = statuses.skipTurn ?? {};

    const skipTurn: Record<number, number> = { ...baseSkipTurn };

    const currentId = state.turn?.currentPlayerId ?? null;
    const currentIndex =
      currentId != null
        ? players.findIndex((p: any) => p?.id === currentId)
        : state.turnIndex;
    const startIndex =
      currentIndex >= 0 ? currentIndex : (typeof state.turnIndex === 'number' ? state.turnIndex : 0);

    let nextIndex = startIndex;
    const skipped: number[] = [];
    for (let attempts = 0; attempts < players.length * 2; attempts += 1) {
      nextIndex = (nextIndex + 1) % players.length;
      const pid = players[nextIndex]?.id;
      if (typeof pid !== 'number' || !Number.isFinite(pid)) continue;
      const remaining = skipTurn[pid] ?? 0;
      if (remaining > 0) {
        skipTurn[pid] = remaining - 1;
        skipped.push(pid);
        continue;
      }
      break;
    }

    let next: GameStateEntity = {
      ...state,
      turnIndex: nextIndex,
      turn: { currentPlayerId: players[nextIndex].id, direction: 1 },
      metadata: {
        ...meta,
        statuses: { ...statuses, skipTurn },
      },
    };

    // Important UX: si un joueur est sautÃ©, on l'annonce, sinon on a l'impression que "rien ne se passe".
    for (const pid of skipped) {
      next = this.core.appendLog(next, `${this.playerName(next, pid)} passe son tour.`);
    }

    return this.appendTurnAnnouncement(next, players[nextIndex].id);
  }

  private autoSkipIfNeeded(state: GameStateEntity): GameStateEntity {
    if (state.pending) return state;
    const meta = this.getMeta(state) as any;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const statuses = meta.statuses ?? { skipTurn: {} };
    const remaining = Number(statuses.skipTurn?.[currentId] ?? 0);
    if (!Number.isFinite(remaining) || remaining <= 0) return state;

    const updatedSkip = {
      ...(statuses.skipTurn ?? {}),
      [currentId]: Math.max(0, remaining - 1),
    };

    let next: GameStateEntity = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        statuses: { ...statuses, skipTurn: updatedSkip },
      },
    };

    next = this.core.appendLog(next, `${this.playerName(next, currentId)} passe son tour.`);
    return this.advanceTurn(next);
  }
}

function defaultAnimalDeck(): AventureSauvageCard[] {
  const deck: AventureSauvageCard[] = [
    {
      id: 1,
      deck: 'animal',
      text: "Vous entendez soudain le rire strident d'une hyÃ¨ne tout prÃ¨s de vous. Surpris, vous trÃ©buchez, tombez au sol et effectuez un roulÃ©-boulÃ© incontrÃ´lÃ© qui vous propulse plus loin sur le chemin. Avancez de deux cases.",
      moveDelta: 2,
    },
    {
      id: 2,
      deck: 'animal',
      text: "Vous surprenez un hippopotame en train de bÃ¢iller largement dans l'eau. EffrayÃ© par sa gueule immense, vous reculez d'une case avant de retrouver votre Ã©quilibre en riant.",
      moveDelta: -1,
    },
    {
      id: 3,
      deck: 'animal',
      text: "Vous voyez un impala sauter agilement devant vous. Vous dÃ©cidez de le suivre et avancez de 3 cases.",
      moveDelta: 3,
    },
    {
      id: 4,
      deck: 'animal',
      text: 'Vous apercevez un suricate se redresser curieusement. Relancez le dÃ©.',
      reroll: true,
    },
    {
      id: 5,
      deck: 'animal',
      text: "Vous observez un flamant rose glisser avec grÃ¢ce Ã  la surface de l'eau. FascinÃ© par sa dÃ©marche Ã©lÃ©gante, vous restez un instant figÃ© Ã  le contempler. Passez votre tour.",
      skipTurns: 1,
    },
    {
      id: 6,
      deck: 'animal',
      text: "Vous entendez le cri joyeux d'un guÃ©pard. Avancez de 1 case.",
      moveDelta: 1,
    },
    {
      id: 7,
      deck: 'animal',
      text: "Vous surprenez un buffle en train de se secouer aprÃ¨s s'Ãªtre roulÃ© dans la boue. Ce spectacle vous amuse et vous fait avancer d'une case.",
      moveDelta: 1,
    },
    {
      id: 8,
      deck: 'animal',
      text: 'Vous marchez silencieusement comme un serpent dans la savane. Avancez de 2 cases.',
      moveDelta: 2,
    },
    {
      id: 9,
      deck: 'animal',
      text: "Vous apercevez un calao majestueux battre des ailes au-dessus de vous. Le souffle de son vol vous pousse lÃ©gÃ¨rement : avancez d'une case.",
      moveDelta: 1,
    },
    {
      id: 10,
      deck: 'animal',
      text: "Vous Ãªtes surpris par un babouin facÃ©tieux faisant tomber un rÃ©gime de bananes sur votre tÃªte. Ã‰tourdi, vous passez votre tour.",
      skipTurns: 1,
    },
    {
      id: 11,
      deck: 'animal',
      text: "Vous entendez le chant joyeux d'un tisserin aux couleurs vives perchÃ© dans un arbre. Son rythme farfelu vous fait battre des mains et taper des pieds : avancez de 2 cases.",
      moveDelta: 2,
    },
    {
      id: 12,
      deck: 'animal',
      text: 'Vous improvisez une mÃ©lodie avec des branches, des feuilles et des fruits tombÃ©s autour de vous. La musique de la jungle vous emporte, et sans vous en rendre compte, vous avancez de 3 cases.',
      moveDelta: 3,
    },
    {
      id: 13,
      deck: 'animal',
      text: "Vous voyez un phacochÃ¨re tournoyer sur lui-mÃªme dans un Ã©lan de folie. Vous rigolez tellement que vous avancez d'une case en suivant son rythme.",
      moveDelta: 1,
    },
    {
      id: 14,
      deck: 'animal',
      text: "Vous surprenez un gecko en train de taper du pied sur une feuille. L'effet est si drÃ´le que vous avancez d'une case.",
      moveDelta: 1,
    },
    {
      id: 15,
      deck: 'animal',
      text: "Vous observez un petit pangolin qui se tortille en rythme sur le chemin. Cela vous amuse tellement que vous avancez d'une case.",
      moveDelta: 1,
    },
    {
      id: 16,
      deck: 'animal',
      text: "Vous comptabilisez les pas d'un grand marabout. Avancez de 2 cases.",
      moveDelta: 2,
    },
    {
      id: 17,
      deck: 'animal',
      text: "Vous poursuivez une grenouille gÃ©ante de nÃ©nuphar en nÃ©nuphar. Ã€ chaque saut, vous glissez, tournez en rond et finissez par reculer d'une case avant de rebondir aussitÃ´t en avant d'une case, en Ã©clatant de rire.",
    },
    {
      id: 18,
      deck: 'animal',
      text: "Vous apercevez une petite mangouste curieuse sur votre chemin. En essayant de l'Ã©viter, vous bondissez maladroitement et atterrissez avec un petit plouf sur une racine. Avancez de 1 case en riant de vous-mÃªme.",
      moveDelta: 1,
    },
    {
      id: 19,
      deck: 'animal',
      text: 'Un rhinocÃ©ros passe juste Ã  cÃ´tÃ© de vous. Vous grimpez sur son dos et, Ã©merveillÃ©, vous avancez de trois cases.',
      moveDelta: 3,
    },
    {
      id: 20,
      deck: 'animal',
      text: "Vous tentez de grimper Ã  un arbre pour observer la savane, mais vous vous retrouvez coincÃ© dans les branches, les pieds dans le vide ! Vous passez votre tour bÃªtement.",
      skipTurns: 1,
    },
  ];
  return deck;
}

function defaultPatteDeck(): AventureSauvageCard[] {
  const deck: AventureSauvageCard[] = [
    {
      id: 1,
      deck: 'patte',
      text: 'Vous croisez une civette endormie en travers du chemin. Surpris, vous restez immobile pour ne pas la rÃ©veiller. Passez votre tour.',
      skipTurns: 1,
    },
    {
      id: 2,
      deck: 'patte',
      text: "Une pluie tropicale tombe soudainement. Vous vous faites Ã©clabousser et glissez un peu. Reculez d'une case.",
      moveDelta: -1,
    },
    {
      id: 3,
      deck: 'patte',
      text: "Le vent fait tomber un nid d'aigles serpentier juste devant vous. Vous restez bouche bÃ©e Ã  observer les petits oisillons s'agiter dans le nid. Passez votre tour.",
      skipTurns: 1,
    },
    {
      id: 4,
      deck: 'patte',
      text: "Un jeune scorpion forestier bloque votre chemin et s'amuse Ã  faire des pirouettes, sa queue tourbillonnant dans les airs. Vous sursautez en riant et reculez d'une case.",
      moveDelta: -1,
    },
    {
      id: 5,
      deck: 'patte',
      text: "Un trÃ¨s jeune fourmilier curieux s'approche de vous et renifle vos bottes comme un petit enfant intriguÃ©. AmusÃ©, il se jette au sol et se roule Ã  vos pieds. Ã‰clatant de rire, vous restez bloquÃ© un instant et ne bougez pas de votre case. Passez votre tour.",
      skipTurns: 1,
    },
    {
      id: 6,
      deck: 'patte',
      text: 'Vous vous reposez sous un baobab pour reprendre des forces. Passez votre tour.',
      skipTurns: 1,
    },
    {
      id: 7,
      deck: 'patte',
      text: 'Vous vous arrÃªtez sous un manguier oÃ¹ un loriquet farceur vous pique votre casquette. Passez votre tour pour la rÃ©cupÃ©rer.',
      skipTurns: 1,
    },
    {
      id: 8,
      deck: 'patte',
      text: 'Vous glissez sur des feuilles de bananier humides tombÃ©es au sol. Passez votre tour.',
      skipTurns: 1,
    },
    {
      id: 9,
      deck: 'patte',
      text: 'Votre parcours est interrompu par un camÃ©lÃ©on changeant de couleur juste devant vous. Vous restez Ã©bahi. Passez votre tour.',
      skipTurns: 1,
    },
    {
      id: 10,
      deck: 'patte',
      text: "Un perroquet gris du Gabon se met Ã  grimper le long d'un tronc et tombe juste Ã  cÃ´tÃ© de vous. Vous sursautez et reculez d'une case.",
      moveDelta: -1,
    },
  ];
  return deck;
}





