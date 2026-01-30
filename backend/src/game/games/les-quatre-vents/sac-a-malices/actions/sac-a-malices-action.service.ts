import { Injectable } from '@nestjs/common';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import type {
  SacCard,
  SacDeck,
  SacMetadata,
  SacTile,
} from '../model/sac-a-malices.types';

@Injectable()
export class SacAMalicesActionService {
  constructor(
    private readonly random: RandomService,
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
      if (type === 'buy') {
        next = this.handleBuy(next, true);
        continue;
      }
      if (type === 'skip_buy') {
        next = this.handleBuy(next, false);
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
    if (meta.statuses?.eliminated?.[currentId]) {
      return this.advanceTurn(state);
    }

    // 2d6
    const r1 = this.random.rollDice(meta as any, 6);
    const r2 = this.random.rollDice(r1.meta as any, 6);
    meta = { ...meta, ...r2.meta };
    const d1 = r1.roll;
    const d2 = r2.roll;
    const sum = d1 + d2;
    const isDouble = d1 === d2;

    let next: GameStateEntity = {
      ...state,
      lastRoll: sum,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };

    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} lance les dés : "${d1}" + "${d2}" = "${sum}".`,
    );

    next = this.handleJailTurn(next, currentId, isDouble, sum);
    if (next.pending) return next;

    meta = this.getMeta(next);
    if (meta.statuses?.eliminated?.[currentId]) {
      next = this.checkWinner(next);
      if (this.getMeta(next).winnerId != null) return { ...next, status: 'finished' };
      return this.advanceTurn(next);
    }

    // Si on est encore en prison après handleJailTurn, le tour est fini.
    if ((meta.statuses?.inJail?.[currentId] ?? 0) > 0) {
      next = this.checkWinner(next);
      if (this.getMeta(next).winnerId != null) return { ...next, status: 'finished' };
      return this.advanceTurn(next);
    }

    // Déplacement
    next = this.moveForward(next, currentId, sum);
    next = this.applyLanding(next, currentId);
    next = this.checkWinner(next);
    if (this.getMeta(next).winnerId != null) return { ...next, status: 'finished' };
    if (next.pending) return next;

    return this.advanceTurn(next);
  }

  private handleBuy(state: GameStateEntity, accept: boolean): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const pending = state.pending as any;
    if (!pending || pending.type !== 'buy') return state;
    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const tileIndex = Number(pending?.data?.tileIndex);
    if (!Number.isFinite(tileIndex)) return state;

    let next: GameStateEntity = { ...state, pending: null };
    if (!accept) {
      next = this.core.appendLog(next, `${this.playerName(next, playerId)} n'achète pas.`);
      next = this.checkWinner(next);
      if (this.getMeta(next).winnerId != null) return { ...next, status: 'finished' };
      return this.advanceTurn(next);
    }

    const meta = this.getMeta(next);
    const tile = meta.tiles?.[tileIndex];
    if (!tile) return this.advanceTurn(next);

    if (meta.ownership?.[tileIndex] != null) {
      next = this.core.appendLog(next, 'Déjà acheté.');
      return this.advanceTurn(next);
    }

    const price = this.getPurchasePrice(meta, tile);
    if (price <= 0) {
      next = this.core.appendLog(next, "Achat impossible (prix inconnu).");
      return this.advanceTurn(next);
    }
    const cash = meta.money?.[playerId] ?? 0;
    if (cash < price) {
      next = this.core.appendLog(next, "Fonds insuffisants.");
      return this.advanceTurn(next);
    }

    next = this.addMoney(next, playerId, -price, { toPot: false });
    next = this.setOwner(next, tileIndex, playerId);
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} achète "${tile.title}" pour ${price} €.`,
    );

    next = this.checkWinner(next);
    if (this.getMeta(next).winnerId != null) return { ...next, status: 'finished' };
    return this.advanceTurn(next);
  }

  private handleJailTurn(
    state: GameStateEntity,
    playerId: number,
    isDouble: boolean,
    rollSum: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const jailTurns = meta.statuses?.inJail?.[playerId] ?? 0;
    if (jailTurns <= 0) return next;

    // Carte sortie de prison
    const outCards = meta.statuses?.getOutOfJail?.[playerId] ?? 0;
    if (outCards > 0) {
      next = this.core.appendLog(next, 'Carte "Sortie de prison" utilisée.');
      next = this.setGetOutOfJail(next, playerId, outCards - 1);
      next = this.setJailTurns(next, playerId, 0);
      return next;
    }

    if (isDouble) {
      next = this.core.appendLog(next, 'Double : vous sortez de prison.');
      next = this.setJailTurns(next, playerId, 0);
      return next;
    }

    const remaining = Math.max(0, jailTurns - 1);
    next = this.setJailTurns(next, playerId, remaining);

    if (remaining <= 0) {
      // Sortie automatique : amende 100€
      next = this.core.appendLog(next, 'Sortie automatique : amende 100 €.');
      next = this.addMoney(next, playerId, -100, { toPot: true });
      return next;
    }

    next = this.core.appendLog(
      next,
      `Prison : vous restez bloqué (${remaining} tour(s)).`,
    );
    return next;
  }

  private applyLanding(state: GameStateEntity, playerId: number): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const pos = meta.positions?.[playerId] ?? 0;
    const tile: SacTile | undefined = tiles[pos];
    if (!tile) return next;

    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} arrive sur ${tile.title}.`,
    );
    if (tile.description && String(tile.description).trim()) {
      next = this.core.appendLog(next, String(tile.description).trim());
    }

    if (tile.type === 'go_to_jail') {
      next = this.core.appendLog(next, 'Direction la prison.');
      return this.sendToJail(next, playerId);
    }

    if (tile.type === 'free') {
      const pot = this.getMeta(next).pot ?? 0;
      if (pot > 0) {
        next = this.core.appendLog(next, `Parc Gratuit : vous récupérez ${pot} €.`);
        next = this.setPot(next, 0);
        next = this.addMoney(next, playerId, pot, { toPot: false });
      } else {
        next = this.core.appendLog(next, 'Parc Gratuit : pot vide.');
      }
      return next;
    }

    if (tile.type === 'tax') {
      const amount = extractEuroAmount(`${tile.title} ${tile.description ?? ''}`);
      if (amount > 0) {
        next = this.core.appendLog(next, `Taxe : ${amount} €.`);
        next = this.addMoney(next, playerId, -amount, { toPot: true });
      }
      return next;
    }

    if (tile.type === 'chance') {
      next = this.core.appendLog(next, 'Chance : pioche.');
      return this.drawAndApply(next, playerId, 'chance');
    }

    if (tile.type === 'community') {
      next = this.core.appendLog(next, 'Caisse de Communauté : pioche.');
      return this.drawAndApply(next, playerId, 'community');
    }

    if (tile.type === 'property' || tile.type === 'station' || tile.type === 'utility') {
      const owner = meta.ownership?.[pos];
      if (owner == null) {
        const price = this.getPurchasePrice(meta, tile);
        const pending: PendingState = {
          type: 'buy',
          playerId,
          blocking: true,
          label: `Acheter "${tile.title}" (${price > 0 ? price + ' €' : 'prix inconnu'}) ?`,
          data: { tileIndex: pos },
        };
        return { ...next, pending };
      }
      if (owner === playerId) return next;
      if ((meta.statuses?.inJail?.[owner] ?? 0) > 0) {
        return this.core.appendLog(next, 'Le propriétaire est en prison : pas de loyer.');
      }
      const rent = this.getRent(meta, tile, owner, state.lastRoll ?? 0);
      if (rent > 0) {
        next = this.core.appendLog(
          next,
          `Loyer : ${rent} € à ${this.playerName(next, owner)}.`,
        );
        next = this.addMoney(next, playerId, -rent, { toPot: false });
        next = this.addMoney(next, owner, rent, { toPot: false });
      }
      return next;
    }

    return next;
  }

  private drawAndApply(
    state: GameStateEntity,
    playerId: number,
    deckId: 'chance' | 'community',
  ): GameStateEntity {
    let next = state;
    const meta0 = this.getMeta(next);
    const drawn = this.drawCard(meta0, deckId);
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...drawn.meta } };
    if (!drawn.card) return next;
    next = this.core.appendLog(next, `Carte : ${drawn.card.text}`);
    return this.applyCard(next, playerId, deckId, drawn.card);
  }

  private applyCard(
    state: GameStateEntity,
    playerId: number,
    deckId: 'chance' | 'community',
    card: SacCard,
  ): GameStateEntity {
    let next = state;
    const text = String(card.text ?? '');

    if (/Sortie de prison/i.test(text)) {
      const meta = this.getMeta(next);
      const current = meta.statuses?.getOutOfJail?.[playerId] ?? 0;
      next = this.core.appendLog(next, 'Vous gardez cette carte.');
      return this.setGetOutOfJail(next, playerId, current + 1);
    }

    const delta = extractMoveDelta(text);
    if (delta !== 0) {
      next = this.core.appendLog(next, `Déplacement : ${delta > 0 ? '+' : ''}${delta}.`);
      next = this.moveForward(next, playerId, delta);
      return this.applyLanding(next, playerId);
    }

    if (/retournez\s+à\s+la\s+case\s+départ/i.test(text)) {
      next = this.core.appendLog(next, 'Retour à Départ.');
      return this.moveTo(next, playerId, 0, { collectStart: false });
    }

    const targetName = extractTargetPlace(text);
    if (targetName) {
      const target = this.findTileByName(this.getMeta(next).tiles, targetName);
      if (target != null) {
        next = this.core.appendLog(next, `Déplacement : vers "${targetName}".`);
        next = this.moveTo(next, playerId, target, { collectStart: true });
        return this.applyLanding(next, playerId);
      }
    }

    const skip = extractSkipTurns(text);
    if (skip > 0) {
      next = this.core.appendLog(next, `Vous perdez ${skip} tour(s).`);
      next = this.addSkip(next, playerId, skip);
      return next;
    }

    const money = extractMoneyDelta(text);
    if (money !== 0) {
      next = this.core.appendLog(next, `Caisse : ${money > 0 ? '+' : ''}${money} €.`);
      next = this.addMoney(next, playerId, money, { toPot: money < 0 });
      return next;
    }

    // Autres effets non implémentés : on log seulement.
    return next;
  }

  private drawCard(
    meta: SacMetadata,
    deckId: 'chance' | 'community',
  ): { card: SacCard | null; meta: SacMetadata } {
    const deck: SacDeck = meta.decks?.[deckId] ?? { cards: [], discard: [] };
    const cards = Array.isArray(deck.cards) ? deck.cards : [];
    const discard = Array.isArray(deck.discard) ? deck.discard : [];

    if (!cards.length && discard.length) {
      const shuffled = this.random.shuffle(meta as any, discard);
      const reshuffled: SacMetadata = {
        ...meta,
        ...shuffled.meta,
        decks: { ...meta.decks, [deckId]: { cards: shuffled.values as any, discard: [] } },
      };
      return this.drawCard(reshuffled, deckId);
    }

    if (!cards.length) return { card: null, meta };
    const [card, ...rest] = cards;
    const keep = /Sortie de prison/i.test(String(card.text ?? ''));
    const nextDeck = keep
      ? { cards: rest, discard }
      : { cards: rest, discard: [...discard, card] };
    const nextMeta: SacMetadata = {
      ...meta,
      decks: { ...meta.decks, [deckId]: nextDeck },
    };
    return { card, meta: nextMeta };
  }

  private moveForward(state: GameStateEntity, playerId: number, delta: number): GameStateEntity {
    const meta = this.getMeta(state);
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const len = tiles.length || 40;
    const pos = meta.positions?.[playerId] ?? 0;
    const nextPos = ((pos + delta) % len + len) % len;
    let next = this.setPos(state, playerId, nextPos);
    if (delta > 0 && nextPos < pos) {
      next = this.core.appendLog(next, 'Passage sur Départ : +200 €.');
      next = this.addMoney(next, playerId, 200, { toPot: false });
    }
    return next;
  }

  private moveTo(
    state: GameStateEntity,
    playerId: number,
    pos: number,
    options: { collectStart: boolean },
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const len = tiles.length || 40;
    const current = meta.positions?.[playerId] ?? 0;
    const target = clamp(pos, 0, len - 1);
    let next = this.setPos(state, playerId, target);
    if (options.collectStart && target < current) {
      next = this.core.appendLog(next, 'Passage sur Départ : +200 €.');
      next = this.addMoney(next, playerId, 200, { toPot: false });
    }
    return next;
  }

  private sendToJail(state: GameStateEntity, playerId: number): GameStateEntity {
    const meta = this.getMeta(state);
    const jailPos = this.findJailTile(meta.tiles) ?? 30;
    let next = this.setPos(state, playerId, jailPos);
    next = this.setJailTurns(next, playerId, 3);
    return next;
  }

  private findJailTile(tiles: SacTile[] | undefined): number | null {
    const list = Array.isArray(tiles) ? tiles : [];
    const idx = list.findIndex((t) => t?.type === 'jail');
    return idx >= 0 ? idx : null;
  }

  private findTileByName(tiles: SacTile[] | undefined, rawName: string): number | null {
    const name = normalize(rawName);
    if (!name) return null;
    const list = Array.isArray(tiles) ? tiles : [];
    const idx = list.findIndex((t) => normalize(stripParens(t?.title ?? '')).includes(name));
    return idx >= 0 ? idx : null;
  }

  private setPos(state: GameStateEntity, playerId: number, pos: number): GameStateEntity {
    const meta = this.getMeta(state);
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const len = tiles.length || 40;
    const nextPos = clamp(pos, 0, len - 1);
    const nextMeta: SacMetadata = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: nextPos },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private setOwner(state: GameStateEntity, tileIndex: number, ownerId: number): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: SacMetadata = {
      ...meta,
      ownership: { ...(meta.ownership ?? {}), [tileIndex]: ownerId },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private setPot(state: GameStateEntity, value: number): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: SacMetadata = { ...meta, pot: Math.max(0, Math.trunc(value)) };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private addSkip(state: GameStateEntity, playerId: number, turns: number): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.statuses?.skipTurn?.[playerId] ?? 0;
    const nextMeta: SacMetadata = {
      ...meta,
      statuses: {
        ...meta.statuses,
        skipTurn: { ...(meta.statuses.skipTurn ?? {}), [playerId]: current + turns },
      },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private setJailTurns(state: GameStateEntity, playerId: number, turns: number): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: SacMetadata = {
      ...meta,
      statuses: {
        ...meta.statuses,
        inJail: { ...(meta.statuses.inJail ?? {}), [playerId]: Math.max(0, Math.trunc(turns)) },
      },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private setGetOutOfJail(state: GameStateEntity, playerId: number, count: number): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: SacMetadata = {
      ...meta,
      statuses: {
        ...meta.statuses,
        getOutOfJail: { ...(meta.statuses.getOutOfJail ?? {}), [playerId]: Math.max(0, Math.trunc(count)) },
      },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private addMoney(
    state: GameStateEntity,
    playerId: number,
    delta: number,
    options: { toPot: boolean },
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.money?.[playerId] ?? 0;
    const nextMoney = current + delta;
    const nextMeta: SacMetadata = {
      ...meta,
      money: { ...(meta.money ?? {}), [playerId]: nextMoney },
      pot: options.toPot ? (meta.pot ?? 0) + Math.max(0, -delta) : meta.pot ?? 0,
    };
    let next: GameStateEntity = { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
    if (nextMoney < 0) {
      next = this.core.appendLog(next, `${this.playerName(next, playerId)} est en faillite !`);
      next = this.setEliminated(next, playerId, true);
    }
    return next;
  }

  private setEliminated(state: GameStateEntity, playerId: number, value: boolean): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: SacMetadata = {
      ...meta,
      statuses: {
        ...meta.statuses,
        eliminated: { ...(meta.statuses.eliminated ?? {}), [playerId]: Boolean(value) },
      },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private getPurchasePrice(meta: SacMetadata, tile: SacTile): number {
    if (tile.type === 'station') return meta.data?.stations?.purchasePrice ?? 0;
    if (tile.type === 'utility') {
      const u = meta.data?.utilities?.find((x) => normalize(x.name) === normalize(tile.title));
      return u?.purchasePrice ?? 0;
    }
    if (tile.type === 'property') {
      const group = meta.data?.groups?.find((g) => normalize(g.color) === normalize(tile.group ?? ''));
      return group?.purchasePrice ?? 0;
    }
    return 0;
  }

  private getRent(meta: SacMetadata, tile: SacTile, ownerId: number, lastRoll: number): number {
    if (tile.type === 'station') {
      const stations = meta.data?.stations?.properties ?? [];
      const count = stations
        .map((name) => this.findTileByName(meta.tiles, name))
        .filter((idx) => idx != null)
        .filter((idx) => meta.ownership?.[idx as number] === ownerId).length;
      const rents = meta.data?.stations?.rents ?? ({} as any);
      const key = String(clamp(count, 1, 4)) as '1' | '2' | '3' | '4';
      return Number(rents[key] ?? 0) || 0;
    }

    if (tile.type === 'utility') {
      const utils = meta.data?.utilities ?? [];
      const idxs = utils
        .map((u) => this.findTileByName(meta.tiles, u.name))
        .filter((idx) => idx != null) as number[];
      const owned = idxs.filter((idx) => meta.ownership?.[idx] === ownerId).length;
      const multiplier = owned >= 2 ? (utils[0]?.multiplier2 ?? 10) : (utils[0]?.multiplier1 ?? 4);
      return Math.max(0, Math.trunc(multiplier * Math.max(0, lastRoll)));
    }

    if (tile.type === 'property') {
      const group = meta.data?.groups?.find((g) => normalize(g.color) === normalize(tile.group ?? ''));
      return Number(group?.rents?.base ?? 0) || 0;
    }

    return 0;
  }

  private advanceTurn(state: GameStateEntity): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return state;
    const meta = this.getMeta(state);
    const statuses = meta.statuses ?? ({} as any);
    const skipTurn = { ...(statuses.skipTurn ?? {}) };
    const eliminated = statuses.eliminated ?? {};

    const currentId = state.turn?.currentPlayerId ?? null;
    const currentIndex =
      currentId != null
        ? players.findIndex((p: any) => p?.id === currentId)
        : state.turnIndex;

    let nextIndex = currentIndex >= 0 ? currentIndex : state.turnIndex;
    let attempts = 0;
    let nextPlayerId = players[nextIndex]?.id ?? players[0].id;

    do {
      nextIndex = (nextIndex + 1) % players.length;
      const pid = players[nextIndex].id;
      if (eliminated?.[pid]) {
        attempts += 1;
        continue;
      }
      const remaining = skipTurn[pid] ?? 0;
      if (remaining > 0) {
        skipTurn[pid] = remaining - 1;
        attempts += 1;
        continue;
      }
      nextPlayerId = pid;
      break;
    } while (attempts < players.length);

    return {
      ...state,
      turnIndex: nextIndex,
      turn: { currentPlayerId: nextPlayerId, direction: 1 },
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        statuses: { ...statuses, skipTurn },
      },
    };
  }

  private checkWinner(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    if (meta.winnerId != null) return state;
    const players = Array.isArray(state.players) ? state.players : [];
    const alive = players
      .map((p) => p?.id)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
      .filter((id) => !meta.statuses?.eliminated?.[id]);
    if (alive.length === 1) {
      const winnerId = alive[0];
      const nextMeta: SacMetadata = { ...meta, winnerId };
      const next = { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
      return this.core.appendLog(next, `${this.playerName(next, winnerId)} remporte la partie !`);
    }
    return state;
  }

  private getMeta(state: GameStateEntity): SacMetadata {
    return (state.metadata ?? {}) as any as SacMetadata;
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

function stripParens(text: string): string {
  return String(text ?? '').replace(/\([^)]*\)/g, '').trim();
}

function normalize(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[’'`]/g, "'")
    .replace(/\s+/g, ' ');
}

function extractEuroAmount(text: string): number {
  const m = text.match(/(\d+)\s*(€|eur)/i);
  const n = m ? Number(m[1]) : 0;
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function extractMoneyDelta(text: string): number {
  const gain = text.match(/(?:recevez|reçois|recois|gagnez|gagne)\s+(\d+)/i);
  if (gain) {
    const n = Number(gain[1]);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  const pay = text.match(/(?:payez|paie|paye)\s+(\d+)/i);
  if (pay) {
    const n = Number(pay[1]);
    if (Number.isFinite(n)) return -Math.trunc(n);
  }
  return 0;
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
  const forward = text.match(/avance(?:z)?\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/i);
  if (forward) return parse(forward[1]);
  const backward = text.match(/recule(?:z)?\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/i);
  if (backward) return -parse(backward[1]);
  return 0;
}

function extractSkipTurns(text: string): number {
  if (/Passez trois tours/i.test(text)) return 3;
  if (/Passez deux tours/i.test(text)) return 2;
  if (/Passez votre prochain tour/i.test(text) || /Passez votre tour/i.test(text)) return 1;
  return 0;
}

function extractTargetPlace(text: string): string | null {
  const m1 = text.match(/avancez\s+jusqu[’']?à\s+la\s+gare\s+de\s+([^.,]+)/i);
  if (m1?.[1]) return `Gare de ${m1[1].trim()}`;
  const m2 = text.match(/avancez\s+(?:directement\s+)?à\s+([^.,]+)/i);
  if (m2?.[1]) return m2[1].trim();
  return null;
}

