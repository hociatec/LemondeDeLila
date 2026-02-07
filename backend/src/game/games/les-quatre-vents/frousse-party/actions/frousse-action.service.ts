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
  FrousseCard,
  FrousseMetadata,
  FrousseTile,
} from '../model/frousse.types';
import { buildPawnSelectionPending } from '../pawn-selection';
import { resolvePawnId } from '../pawns.utils';

@Injectable()
export class FrousseActionService {
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
      if (type === 'choose_pawn') {
        next = this.handleChoosePawn(next, action);
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
      if (type === 'choose_target') {
        next = this.handleChooseTarget(next, action);
      }
    }
    next = this.ensurePawnSelection(next);
    return next;
  }

  private handleChoosePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_pawn') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const payload = (action.payload ?? {}) as any;
    const pawnId = resolvePawnId(
      payload.pawnId ?? payload.pawn ?? payload.value ?? null,
    );
    if (!pawnId) return state;

    const options = Array.isArray(pending?.data?.pawns)
      ? pending.data.pawns
      : [];
    const chosen = options.find((p: any) => resolvePawnId(p?.id) === pawnId);
    if (!chosen) return state;

    const players = (state.players ?? []).map((p) => {
      if (p?.id !== playerId) return p;
      return {
        ...p,
        pawn: chosen.id,
        pawnLabel: String(chosen.title ?? chosen.id ?? ''),
      };
    });

    const next: GameStateEntity = {
      ...state,
      players,
      pending: null,
    };

    const label = chosen.title ?? chosen.id ?? 'pion';
    return this.core.appendLog(
      next,
      `[Frousse Party] ${this.playerName(next, playerId)} choisit le pion: ${label}.`,
    );
  }

  private ensurePawnSelection(state: GameStateEntity): GameStateEntity {
    if (state.pending) return state;
    const players = Array.isArray(state.players) ? state.players : [];
    const pending = buildPawnSelectionPending(players, this.getMeta(state));
    if (!pending) return state;
    return { ...state, pending };
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    if (state.pending) return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    let meta = this.getMeta(state);

    // Blocages (tentatives de sortie).
    const blocked = meta.statuses?.blocked?.[currentId] ?? null;
    if (blocked) {
      const roll = this.roll(meta, currentId);
      meta = roll.meta;
      let next: GameStateEntity = {
        ...state,
        metadata: { ...(state.metadata ?? {}), ...meta },
        lastRoll: roll.value,
      };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} tente de se libérer : dé = "${roll.value}".`,
      );
      const ok =
        blocked.kind === 'need_roll_one_of'
          ? blocked.allowed.includes(roll.value)
          : blocked.kind === 'need_roll_min'
            ? roll.value >= blocked.min
            : blocked.kind === 'need_roll_even'
              ? roll.value % 2 === 0
              : false;
      if (!ok) {
        next = this.core.appendLog(
          next,
          `${this.playerName(next, currentId)} reste bloqué.`,
        );
        return this.turns.advanceTurn(next);
      }
      meta = this.getMeta(next);
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          blocked: { ...(meta.statuses.blocked ?? {}), [currentId]: null },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} se libère !`,
      );
      return this.turns.advanceTurn(next);
    }

    const roll = this.roll(meta, currentId);
    meta = roll.meta;

    let move = roll.value;
    const cap = meta.statuses?.nextMoveCap?.[currentId] ?? 0;
    if (cap > 0) {
      move = Math.min(move, cap);
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          nextMoveCap: { ...(meta.statuses.nextMoveCap ?? {}), [currentId]: 0 },
        },
      };
    }

    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta },
      lastRoll: roll.value,
    };
    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} lance le dé : "${roll.value}".`,
    );

    // Effet conditionnel: "Si vous faites un trois, reculez de 2 cases."
    if (meta.statuses?.nextRollIfThreeBackTwo?.[currentId] === true) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          nextRollIfThreeBackTwo: {
            ...(meta.statuses.nextRollIfThreeBackTwo ?? {}),
            [currentId]: false,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      if (roll.value === 3) {
        next = this.core.appendLog(next, 'Effet : 3 au dé, recul de 2 cases.');
        next = this.move(next, currentId, -2);
      }
      meta = this.getMeta(next);
    }

    next = this.move(next, currentId, move);
    next = this.applyLanding(next, currentId);

    meta = this.getMeta(next);
    if (meta.winnerId != null) return { ...next, status: 'finished' };
    if (next.pending) return next;

    // Relance immédiate (cartes bonus/farces).
    if ((meta as any).keepTurnNow === true) {
      delete (meta as any).keepTurnNow;
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} rejoue.`,
      );
    }

    return this.turns.advanceTurn(next);
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
    if (!ctx || ctx.kind !== 'swap' || ctx.actorId !== currentId)
      return { ...state, pending: null };

    const actorPos = meta.positions?.[currentId] ?? 0;
    const targetPos = meta.positions?.[targetPlayerId] ?? 0;
    meta = {
      ...meta,
      positions: {
        ...(meta.positions ?? {}),
        [currentId]: targetPos,
        [targetPlayerId]: actorPos,
      },
      pendingContext: null,
    };

    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };
    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} échange sa position avec ${this.playerName(next, targetPlayerId)}.`,
    );
    return this.turns.advanceTurn(next);
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const pending = state.pending as any;
    if (!pending || pending.type !== 'draw') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (!playerId) return state;

    const cleared: GameStateEntity = { ...state, pending: null };
    return this.applyDrawCard(cleared, playerId);
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const pos = meta.positions?.[playerId] ?? 0;
    const tile = meta.tiles[pos] as FrousseTile | undefined;

    if (tile) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} arrive sur Case ${tile.n} - ${tile.title}.`,
      );
      if (tile.type === 'card') {
        next = this.core.appendLog(next, `Pioche une carte.`);
      } else if (tile.type === 'finish') {
        next = this.core.appendLog(next, `Effet : case d'arrivée.`);
      }
    } else {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} arrive sur Case ${pos + 1}.`,
      );
    }

    if (pos >= 49) {
      meta = { ...meta, winnerId: playerId };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} s'échappe du manoir !`,
      );
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (!tile) return next;
    if (tile.type !== 'card') return next;
    return {
      ...next,
      pending: {
        type: 'draw',
        playerId,
        blocking: true,
        label: 'Piocher une carte (Espace).',
      },
    };
  }

  private applyDrawCard(state: GameStateEntity, playerId: number): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);

    const draw = this.drawCard(meta);
    meta = draw.meta;
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    if (!draw.card) return next;

    // Ignore ghost/trap.
    if (
      /Fantôme/i.test(draw.card.category) &&
      meta.statuses.ignoreNextGhost?.[playerId]
    ) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          ignoreNextGhost: {
            ...(meta.statuses.ignoreNextGhost ?? {}),
            [playerId]: false,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(next, 'Carte fantôme ignorée.');
    }
    if (
      /Farce/i.test(draw.card.category) &&
      meta.statuses.ignoreNextPrank?.[playerId]
    ) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          ignoreNextPrank: {
            ...(meta.statuses.ignoreNextPrank ?? {}),
            [playerId]: false,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(next, 'Farce ignorée.');
    }
    if (
      /Piège/i.test(draw.card.category) &&
      meta.statuses.ignoreNextTrap?.[playerId]
    ) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          ignoreNextTrap: {
            ...(meta.statuses.ignoreNextTrap ?? {}),
            [playerId]: false,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(next, 'Piège ignoré.');
    }

    next = this.core.appendLog(
      next,
      `Carte (${draw.card.category}) : ${draw.card.text}`,
    );
    return this.applyCard(next, playerId, draw.card);
  }

  private applyCard(
    state: GameStateEntity,
    playerId: number,
    card: FrousseCard,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const text = card.text;

    // Swap with another player.
    if (
      /échange(r|z) votre place/i.test(text) ||
      /Echangez immédiatement vos places/i.test(text)
    ) {
      const targets = this.otherPlayers(next, playerId);
      if (!targets.length) return next;
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

    // Ignore next trap / ghost.
    if (
      /Ignorez le prochain piège/i.test(text) ||
      /Ignorez les pièges/i.test(text)
    ) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          ignoreNextTrap: {
            ...(meta.statuses.ignoreNextTrap ?? {}),
            [playerId]: true,
          },
        },
      };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }
    if (/Ignorez la prochaine carte Fantôme/i.test(text)) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          ignoreNextGhost: {
            ...(meta.statuses.ignoreNextGhost ?? {}),
            [playerId]: true,
          },
        },
      };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (/annule une farce/i.test(text) || /rien ne vous arrive/i.test(text)) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          ignoreNextPrank: {
            ...(meta.statuses.ignoreNextPrank ?? {}),
            [playerId]: true,
          },
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(next, 'Protection farce activée.');
    }

    if (/Sautez\s+6\s+cases/i.test(text)) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} saute 6 cases.`,
      );
      next = this.move(next, playerId, 6);
      return this.applyLanding(next, playerId);
    }

    // Block rules.
    const need56 = text.match(/lancer un (\d) ou un (\d)/i);
    if (need56) {
      const a = Number(need56[1]);
      const b = Number(need56[2]);
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          blocked: {
            ...(meta.statuses.blocked ?? {}),
            [playerId]: { kind: 'need_roll_one_of', allowed: [a, b] },
          },
        },
      };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }
    const need6 = text.match(/obtenir un 6/i);
    if (need6 && /jusqu/i.test(text)) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          blocked: {
            ...(meta.statuses.blocked ?? {}),
            [playerId]: { kind: 'need_roll_one_of', allowed: [6] },
          },
        },
      };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }
    const needMin = text.match(/obtenez pas un (\d) ou plus/i);
    if (needMin) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          blocked: {
            ...(meta.statuses.blocked ?? {}),
            [playerId]: { kind: 'need_roll_min', min: Number(needMin[1]) },
          },
        },
      };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }
    if (/nombre pair/i.test(text)) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          blocked: {
            ...(meta.statuses.blocked ?? {}),
            [playerId]: { kind: 'need_roll_even' },
          },
        },
      };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    // Next move limited to 1.
    if (/n['’]avancerez que d['’](une|un)e seule case/i.test(text)) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          nextMoveCap: { ...(meta.statuses.nextMoveCap ?? {}), [playerId]: 1 },
        },
      };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    // Next roll malus -2.
    if (/malus de moins 2/i.test(text) || /malus de -2/i.test(text)) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          nextRollMalus: {
            ...(meta.statuses.nextRollMalus ?? {}),
            [playerId]: -2,
          },
        },
      };
      (meta as any).keepTurnNow = true;
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} rejoue (malus au prochain dé).`,
      );
    }

    // Next roll: keep lowest of two.
    if (
      /gardez le plus petit/i.test(text) ||
      /gardez le chiffre le plus bas/i.test(text)
    ) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          nextRollKeepLowest: {
            ...(meta.statuses.nextRollKeepLowest ?? {}),
            [playerId]: true,
          },
        },
      };
      (meta as any).keepTurnNow = true;
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} rejoue (garde le plus petit des deux dés).`,
      );
    }

    // Next roll double.
    if (/Doublez votre prochain lancer/i.test(text)) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          nextRollDouble: {
            ...(meta.statuses.nextRollDouble ?? {}),
            [playerId]: true,
          },
        },
      };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    // Si vous faites un trois, reculez de 2 cases (prochain dé).
    if (/Si vous faites un trois, reculez de 2 cases/i.test(text)) {
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          nextRollIfThreeBackTwo: {
            ...(meta.statuses.nextRollIfThreeBackTwo ?? {}),
            [playerId]: true,
          },
        },
      };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    // Téléport jusqu'à la case 40.
    if (/jusqu'à la case 40/i.test(text) || /jusqu’à la case 40/i.test(text)) {
      return this.setPos(next, playerId, 39);
    }

    // Relance immédiate.
    if (
      /Relancez le dé/i.test(text) ||
      (/Relancez/i.test(text) && /dé/i.test(text))
    ) {
      (meta as any).keepTurnNow = true;
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} rejoue.`,
      );
    }

    // Global: others +3 and you skip.
    if (/laissant les autres joueurs filer de 3 cases/i.test(text)) {
      const others = this.otherPlayerIds(meta, playerId);
      for (const pid of others) {
        meta.positions[pid] = clamp((meta.positions[pid] ?? 0) + 3, 0, 49);
      }
      const curr = meta.statuses.skipTurn?.[playerId] ?? 0;
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          skipTurn: { ...(meta.statuses.skipTurn ?? {}), [playerId]: curr + 1 },
        },
      };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    // Immediate roll: if odd then skip.
    if (/si le résultat est impair, passez votre tour/i.test(text)) {
      const out = this.random.rollDice(meta as any, 6);
      meta = { ...meta, ...out.meta };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = this.core.appendLog(next, `Test : dé = "${out.roll}".`);
      if (out.roll % 2 === 1) {
        const curr = meta.statuses.skipTurn?.[playerId] ?? 0;
        meta = {
          ...meta,
          statuses: {
            ...meta.statuses,
            skipTurn: {
              ...(meta.statuses.skipTurn ?? {}),
              [playerId]: curr + 1,
            },
          },
        };
        return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      }
      return next;
    }

    // Skip turns.
    const skip = extractSkipTurns(text);
    if (skip > 0) {
      const curr = meta.statuses.skipTurn?.[playerId] ?? 0;
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
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    // Go to case 1.
    if (
      /Retour à la case une/i.test(text) ||
      (/Retournez/i.test(text) && /case une/i.test(text))
    ) {
      return this.setPos(next, playerId, 0);
    }

    // Go to kitchen (case 20 => index 19).
    if (/Allez en cuisine/i.test(text)) {
      return this.setPos(next, playerId, 19);
    }

    // Move delta (inclut "avance X puis recule Y").
    const delta = extractMoveDelta(text);
    if (delta !== 0) {
      next = this.move(next, playerId, delta);
      return this.applyLanding(next, playerId);
    }

    return next;
  }

  private roll(
    meta: FrousseMetadata,
    playerId: number,
  ): { value: number; meta: FrousseMetadata } {
    let outMeta = meta;

    const keepLowest = outMeta.statuses.nextRollKeepLowest?.[playerId] === true;
    if (keepLowest) {
      const a = this.random.rollDice(outMeta as any, 6);
      outMeta = { ...outMeta, ...a.meta };
      const b = this.random.rollDice(outMeta as any, 6);
      outMeta = { ...outMeta, ...b.meta };
      outMeta = {
        ...outMeta,
        statuses: {
          ...outMeta.statuses,
          nextRollKeepLowest: {
            ...(outMeta.statuses.nextRollKeepLowest ?? {}),
            [playerId]: false,
          },
        },
      };
      return { value: Math.min(a.roll, b.roll), meta: outMeta };
    }

    const single = this.random.rollDice(outMeta as any, 6);
    outMeta = { ...outMeta, ...single.meta };
    let value = single.roll;

    const malus = outMeta.statuses.nextRollMalus?.[playerId] ?? 0;
    if (malus !== 0) {
      value = clamp(value + malus, 1, 6);
      outMeta = {
        ...outMeta,
        statuses: {
          ...outMeta.statuses,
          nextRollMalus: {
            ...(outMeta.statuses.nextRollMalus ?? {}),
            [playerId]: 0,
          },
        },
      };
    }

    if (outMeta.statuses.nextRollDouble?.[playerId]) {
      value = value * 2;
      outMeta = {
        ...outMeta,
        statuses: {
          ...outMeta.statuses,
          nextRollDouble: {
            ...(outMeta.statuses.nextRollDouble ?? {}),
            [playerId]: false,
          },
        },
      };
    }

    return { value, meta: outMeta };
  }

  private move(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const pos = meta.positions?.[playerId] ?? 0;
    const nextPos = clamp(pos + delta, 0, 49);
    return this.setPos(state, playerId, nextPos);
  }

  private setPos(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: FrousseMetadata = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: clamp(pos, 0, 49) },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private drawCard(meta: FrousseMetadata): {
    card: FrousseCard | null;
    meta: FrousseMetadata;
  } {
    const deck = Array.isArray(meta.decks?.cards) ? meta.decks.cards : [];
    const discard = Array.isArray(meta.decks?.discard)
      ? meta.decks.discard
      : [];
    if (!deck.length && discard.length) {
      const shuffled = this.random.shuffle(meta as any, discard);
      const reshuffled: FrousseMetadata = {
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

  private otherPlayers(
    state: GameStateEntity,
    me: number,
  ): Array<{ id: number; username: string }> {
    const players = Array.isArray(state.players) ? state.players : [];
    return players
      .filter((p) => p?.id != null && p.id !== me)
      .map((p) => ({ id: p.id, username: this.playerName(state, p.id) }));
  }

  private otherPlayerIds(meta: FrousseMetadata, me: number): number[] {
    return Object.keys(meta.positions ?? {})
      .map(Number)
      .filter((id) => Number.isFinite(id) && id !== me);
  }

  private getMeta(state: GameStateEntity): FrousseMetadata {
    return (state.metadata ?? {}) as any as FrousseMetadata;
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

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function extractMoveDelta(text: string): number {
  const combo = text.match(
    /Avancez\s+de\s+(\d+)\s+cases?,\s+puis\s+reculez\s+de\s+(\d+)\s+cases?/i,
  );
  if (combo) return (Number(combo[1]) || 0) - (Number(combo[2]) || 0);

  const numWords: Record<string, number> = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
  };

  const parseNumberish = (raw: string): number => {
    const n = Number(raw);
    if (Number.isFinite(n) && n !== 0) return n;
    const key = raw.trim().toLowerCase();
    return numWords[key] ?? 0;
  };

  const narrativeForward = text.match(
    /avancez[\s\S]*?d['’]\s*(\d+|un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (narrativeForward) return parseNumberish(narrativeForward[1]);

  const narrativeBack = text.match(
    /recul(?:ez|ant|e|es)?[\s\S]*?d['’]\s*(\d+|un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (narrativeBack) return -parseNumberish(narrativeBack[1]);

  const forwardApos = text.match(/Avancez\s+d['’]\s*(\d+)\s+case/i);
  if (forwardApos) return Number(forwardApos[1]) || 0;
  const forwardAposWords = text.match(
    /Avancez\s+d['’]\s*(un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (forwardAposWords) return parseNumberish(forwardAposWords[1]);

  const forward = text.match(/Avancez\s+de\s+(\d+)\s+case/i);
  if (forward) return Number(forward[1]) || 0;
  const forwardWords = text.match(
    /Avancez\s+de\s+(un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (forwardWords) return parseNumberish(forwardWords[1]);

  const backApos = text.match(/Reculez\s+d['’]\s*(\d+)\s+case/i);
  if (backApos) return -(Number(backApos[1]) || 0);
  const backAposWords = text.match(
    /Reculez\s+d['’]\s*(un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (backAposWords) return -parseNumberish(backAposWords[1]);

  const back = text.match(/Reculez\s+de\s+(\d+)\s+case/i);
  if (back) return -(Number(back[1]) || 0);
  const backWords = text.match(
    /Reculez\s+de\s+(un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (backWords) return -parseNumberish(backWords[1]);
  const jump = text.match(/Sautez\s+(\d+)\s+case/i);
  if (jump) return Number(jump[1]) || 0;
  return 0;
}

function extractSkipTurns(text: string): number {
  if (/Passez deux tours/i.test(text)) return 2;
  if (/Passez trois tours/i.test(text)) return 3;
  if (/Passez votre tour/i.test(text) || /Passez un tour/i.test(text)) return 1;
  return 0;
}
