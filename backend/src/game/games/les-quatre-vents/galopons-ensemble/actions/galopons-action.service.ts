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
  GaloponsCard,
  GaloponsMetadata,
  GaloponsTile,
} from '../model/galopons.types';

@Injectable()
export class GaloponsActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
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
      if (type === 'choose_target') {
        next = this.handleChooseTarget(next, action);
      }
    }
    return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    if (state.pending) return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    let meta = this.getMeta(state);

    // Paiement des dettes (\"il vous en rendra une plus tard\") : si possible, le joueur rend 1 pomme avant de jouer.
    const iou = meta.ious?.[currentId] ?? null;
    if (iou && typeof iou === 'object') {
      const creditors = Object.keys(iou)
        .map(Number)
        .filter((id) => Number.isFinite(id) && (iou[id] ?? 0) > 0);
      if (creditors.length && (meta.apples?.[currentId] ?? 0) > 0) {
        const creditorId = creditors[0];
        const nextApples = { ...(meta.apples ?? {}) };
        nextApples[currentId] = (nextApples[currentId] ?? 0) - 1;
        nextApples[creditorId] = (nextApples[creditorId] ?? 0) + 1;

        const nextIous = { ...(meta.ious ?? {}) };
        const mine = { ...(nextIous[currentId] ?? {}) };
        mine[creditorId] = Math.max(0, (mine[creditorId] ?? 0) - 1);
        nextIous[currentId] = mine;

        meta = { ...meta, apples: nextApples, ious: nextIous };
      }
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
    if (next.pending) return next;

    // Fin de manche : si déclenchée et que tous ont joué.
    if (meta.finish?.triggered && meta.finish.pendingIds.length === 0) {
      return this.finishGame(next);
    }

    // Rejouer immédiat ? (déclenché par carte)
    const keepTurn = (meta as any).keepTurn === true;
    if (keepTurn) {
      meta = { ...meta };
      delete (meta as any).keepTurn;
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} rejoue.`,
      );
    }

    // Si fin de manche déclenchée, retirer le joueur courant des pendingIds.
    if (meta.finish?.triggered) {
      const pendingIds = meta.finish.pendingIds.filter(
        (id) => id !== currentId,
      );
      meta = { ...meta, finish: { ...meta.finish, pendingIds } };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
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
    if (!ctx || ctx.actorId !== currentId) return { ...state, pending: null };

    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: { ...(state.metadata ?? {}), ...meta, pendingContext: null },
    };

    if (ctx.kind === 'pair_advance') {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} et ${this.playerName(next, targetPlayerId)} avancent d'une case.`,
      );
      next = this.move(next, currentId, 1);
      next = this.move(next, targetPlayerId, 1);
      next = this.applyLanding(next, currentId);
      if (ctx.replayAfter)
        return this.core.appendLog(
          next,
          `${this.playerName(next, currentId)} rejoue.`,
        );
      return this.turns.advanceTurn(next);
    }

    if (ctx.kind === 'give_apple') {
      const a = meta.apples?.[currentId] ?? 0;
      if (a <= 0) {
        next = this.core.appendLog(
          next,
          `${this.playerName(next, currentId)} n'a pas de pomme à donner.`,
        );
        if (ctx.replayAfter)
          return this.core.appendLog(
            next,
            `${this.playerName(next, currentId)} rejoue.`,
          );
        return this.turns.advanceTurn(next);
      }
      meta = this.getMeta(next);
      const nextApples = {
        ...meta.apples,
        [currentId]: a - 1,
        [targetPlayerId]: (meta.apples?.[targetPlayerId] ?? 0) + 1,
      };
      const nextIous = { ...(meta.ious ?? {}) };
      const forTarget = { ...(nextIous[targetPlayerId] ?? {}) };
      forTarget[currentId] = (forTarget[currentId] ?? 0) + 1;
      nextIous[targetPlayerId] = forTarget;
      meta = { ...meta, apples: nextApples, ious: nextIous };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} donne une pomme à ${this.playerName(next, targetPlayerId)}.`,
      );
      next = this.core.appendLog(
        next,
        `${this.playerName(next, targetPlayerId)} devra rendre une pomme plus tard.`,
      );
      if (ctx.replayAfter)
        return this.core.appendLog(
          next,
          `${this.playerName(next, currentId)} rejoue.`,
        );
      return this.turns.advanceTurn(next);
    }

    if (ctx.kind === 'help_advance') {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} aide ${this.playerName(next, targetPlayerId)} : +2 cases.`,
      );
      next = this.move(next, targetPlayerId, 2);
      meta = this.getMeta(next);
      meta = {
        ...meta,
        apples: {
          ...meta.apples,
          [currentId]: (meta.apples?.[currentId] ?? 0) + 1,
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} reçoit une pomme en remerciement.`,
      );
      if (ctx.replayAfter)
        return this.core.appendLog(
          next,
          `${this.playerName(next, currentId)} rejoue.`,
        );
      return this.turns.advanceTurn(next);
    }

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
    const tile = meta.tiles[pos] as GaloponsTile | undefined;
    if (!tile) return next;

    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} met ${this.pawnLabel(next, playerId)} en case ${tile.n} (${tile.title}).`,
    );
    if (tile.type === 'card') {
      next = this.core.appendLog(next, `Piochez une carte Aventure.`);
    } else if (tile.type === 'bonus') {
      next = this.core.appendLog(next, `Gagnez des pommes.`);
    } else if (tile.type === 'skip') {
      next = this.core.appendLog(next, `Passez des tours.`);
    } else if (tile.type === 'finish') {
      next = this.core.appendLog(next, `Écurie finale.`);
    }

    // Si arrivée : déclenche fin de manche.
    if (tile.type === 'finish') {
      if (!meta.finish?.triggered) {
        const others = Object.keys(meta.positions ?? {})
          .map(Number)
          .filter((id) => Number.isFinite(id) && id !== playerId);
        meta = {
          ...meta,
          apples: {
            ...meta.apples,
            [playerId]: (meta.apples?.[playerId] ?? 0) + 1,
          },
          finish: {
            triggered: true,
            starterId: playerId,
            pendingIds: others,
            bonusGiven: true,
          },
        };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        next = this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} atteint l'écurie finale (+1 pomme).`,
        );
      }
      return next;
    }

    // Si case occupée : l'autre recule de 5.
    const occupant = this.findOccupant(meta, playerId, pos);
    if (occupant != null) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} rattrape ${this.playerName(next, occupant)} : ${this.playerName(next, occupant)} recule de 5 cases.`,
      );
      next = this.move(next, occupant, -5);
      meta = this.getMeta(next);
    }

    if (tile.type === 'bonus') {
      const gain = typeof tile.apples === 'number' ? tile.apples : 1;
      meta = {
        ...meta,
        apples: {
          ...meta.apples,
          [playerId]: (meta.apples?.[playerId] ?? 0) + gain,
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} gagne ${gain} pomme(s).`,
      );
    }

    if (tile.type === 'skip') {
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
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} passe ${turns} tour(s).`,
      );
    }

    if (tile.type === 'card') {
      return {
        ...next,
        pending: {
          type: 'draw',
          playerId,
          blocking: true,
          label: 'Piocher une carte Aventure (Espace).',
        },
      };
    }

    return next;
  }

  private applyDrawCard(state: GameStateEntity, playerId: number): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const draw = this.drawCard(meta);
    meta = draw.meta;
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    if (!draw.card) return next;
    next = this.core.appendLog(next, `Carte Aventure : ${draw.card.text}`);
    return this.applyCard(next, playerId, draw.card);
  }

  private applyCard(
    state: GameStateEntity,
    playerId: number,
    card: GaloponsCard,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const text = card.text;
    const replayAfter = /Rejouez/i.test(text);

    // Donner une pomme (peut être combiné avec "Rejouez immédiatement").
    if (/Donnez-lui une pomme/i.test(text)) {
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
      meta = {
        ...meta,
        pendingContext: { kind: 'give_apple', actorId: playerId, replayAfter },
      };
      return {
        ...next,
        pending,
        metadata: { ...(next.metadata ?? {}), ...meta },
      };
    }

    // Rejouer.
    if (/Rejouez/i.test(text)) {
      (meta as any).keepTurn = true;
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    // Pomme(s).
    const apples = text.match(/Recevez\s+(\d+)\s+jetons?\s+Pomme/i);
    if (apples) {
      const gain = Number(apples[1]) || 0;
      meta = {
        ...meta,
        apples: {
          ...meta.apples,
          [playerId]: (meta.apples?.[playerId] ?? 0) + gain,
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} gagne ${gain} pomme(s).`,
      );
    }
    if (
      /Recevez un jeton pomme/i.test(text) ||
      /Gagnez 1 jeton Pomme/i.test(text)
    ) {
      meta = {
        ...meta,
        apples: {
          ...meta.apples,
          [playerId]: (meta.apples?.[playerId] ?? 0) + 1,
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} gagne 1 pomme.`,
      );
    }

    // Passe ton tour.
    if (/Passez votre tour/i.test(text)) {
      const curr = meta.statuses?.skipTurn?.[playerId] ?? 0;
      meta = {
        ...meta,
        statuses: {
          ...meta.statuses,
          skipTurn: { ...(meta.statuses.skipTurn ?? {}), [playerId]: curr + 1 },
        },
      };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    // Tous restent sur place pendant un tour.
    if (/Tous les joueurs restent sur place pendant un tour/i.test(text)) {
      const skip = { ...(meta.statuses.skipTurn ?? {}) };
      for (const id of Object.keys(meta.positions ?? {})
        .map(Number)
        .filter(Number.isFinite)) {
        skip[id] = (skip[id] ?? 0) + 1;
      }
      meta = { ...meta, statuses: { ...meta.statuses, skipTurn: skip } };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    // Choisir un joueur et avancer tous les deux.
    if (
      /Choisissez un joueur et avancez tout les deux d'une case/i.test(text)
    ) {
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
      meta = {
        ...meta,
        pendingContext: {
          kind: 'pair_advance',
          actorId: playerId,
          replayAfter,
        },
      };
      return {
        ...next,
        pending,
        metadata: { ...(next.metadata ?? {}), ...meta },
      };
    }

    // Aider un autre joueur en +2 et recevoir une pomme.
    if (/aidez un autre joueur en le faisant avancer de 2 cases/i.test(text)) {
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
      meta = {
        ...meta,
        pendingContext: {
          kind: 'help_advance',
          actorId: playerId,
          replayAfter,
        },
      };
      return {
        ...next,
        pending,
        metadata: { ...(next.metadata ?? {}), ...meta },
      };
    }

    // Défausser une pomme.
    if (
      /Défaussez-vous d''une pomme/i.test(text) ||
      /Défaussez-vous d'une pomme/i.test(text)
    ) {
      const a = meta.apples?.[playerId] ?? 0;
      if (a > 0) {
        meta = { ...meta, apples: { ...meta.apples, [playerId]: a - 1 } };
        return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      }
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} n'a pas de pomme à défausser.`,
      );
    }

    // Avance jusqu'à prochaine région.
    if (/jusqu['’]à la prochaine case forêt/i.test(text)) {
      const nextPos = findNext(
        meta.tiles,
        meta.positions[playerId] ?? 0,
        (t) => t.region === 'foret',
      );
      if (nextPos != null) {
        next = this.setPos(next, playerId, nextPos);
        return this.applyLanding(next, playerId);
      }
    }
    if (/jusqu['’]à la prochaine case montagne/i.test(text)) {
      const nextPos = findNext(
        meta.tiles,
        meta.positions[playerId] ?? 0,
        (t) => t.region === 'montagne',
      );
      if (nextPos != null) {
        next = this.setPos(next, playerId, nextPos);
        return this.applyLanding(next, playerId);
      }
    }

    const delta = extractMoveDelta(text);
    if (delta !== 0) {
      next = this.move(next, playerId, delta);
      return this.applyLanding(next, playerId);
    }

    return next;
  }

  private finishGame(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const entries = Object.entries(meta.apples ?? {}).map(([id, a]) => ({
      id: Number(id),
      apples: Number(a),
    }));
    const best = entries
      .filter((e) => Number.isFinite(e.id))
      .sort((a, b) => b.apples - a.apples)[0];
    if (!best) return { ...state, status: 'finished' };
    const nextMeta: GaloponsMetadata = { ...meta, winnerId: best.id };
    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
      status: 'finished',
    };
    next = this.core.appendLog(
      next,
      `${this.playerName(next, best.id)} remporte la partie avec ${best.apples} pomme(s) !`,
    );
    return next;
  }

  private move(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const pos = meta.positions?.[playerId] ?? 0;
    return this.setPos(state, playerId, clamp(pos + delta, 0, 39));
  }

  private setPos(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: GaloponsMetadata = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: clamp(pos, 0, 39) },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private drawCard(meta: GaloponsMetadata): {
    card: GaloponsCard | null;
    meta: GaloponsMetadata;
  } {
    const deck = Array.isArray(meta.decks?.cards) ? meta.decks.cards : [];
    const discard = Array.isArray(meta.decks?.discard)
      ? meta.decks.discard
      : [];
    if (!deck.length && discard.length) {
      const shuffled = this.random.shuffle(meta as any, discard);
      const reshuffled: GaloponsMetadata = {
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

  private findOccupant(
    meta: GaloponsMetadata,
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

  private otherPlayers(
    state: GameStateEntity,
    me: number,
  ): Array<{ id: number; username: string }> {
    const players = Array.isArray(state.players) ? state.players : [];
    return players
      .filter((p) => p?.id != null && p.id !== me)
      .map((p) => ({ id: p.id, username: this.playerName(state, p.id) }));
  }

  private getMeta(state: GameStateEntity): GaloponsMetadata {
    return (state.metadata ?? {}) as any as GaloponsMetadata;
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
    const player = players.find((x: any) => x?.id === id) as any;
    const pawn =
      typeof player?.pawn === 'string' ? String(player.pawn).trim() : '';
    const resolved = pawn || this.playerName(state, id);
    return `le pion "${resolved}"`;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function extractMoveDelta(text: string): number {
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

  const forwardApos = text.match(/Avancez\s+d['’]\s*(\d+)\s+case/i);
  if (forwardApos) return Number(forwardApos[1]) || 0;
  const forwardOneApos = text.match(/Avancez\s+d['’]\s*(un|une)\s+case/i);
  if (forwardOneApos) return 1;

  const forward = text.match(/Avancez\s+de\s+(\d+)\s+case/i);
  if (forward) return Number(forward[1]) || 0;
  const forwardWords = text.match(
    /Avancez\s+de\s+(un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (forwardWords) return parseNumberish(forwardWords[1]);

  const backApos = text.match(/Reculez\s+d['’]\s*(\d+)\s+case/i);
  if (backApos) return -(Number(backApos[1]) || 0);
  const backOneApos = text.match(/Reculez\s+d['’]\s*(un|une)\s+case/i);
  if (backOneApos) return -1;

  const back = text.match(/Reculez\s+de\s+(\d+)\s+case/i);
  if (back) return -(Number(back[1]) || 0);
  const backWords = text.match(
    /Reculez\s+de\s+(un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (backWords) return -parseNumberish(backWords[1]);

  return 0;
}

function findNext(
  tiles: GaloponsTile[],
  start: number,
  predicate: (t: GaloponsTile) => boolean,
): number | null {
  for (let i = start + 1; i < tiles.length; i += 1) {
    if (predicate(tiles[i])) return i;
  }
  return null;
}
