import { Injectable, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { RandomService } from '../../../modules/random/services/random.service';
import type {
  TriominoMetadata,
  TriominoPlacement,
  TriominoTile,
} from './model/triomino.model';
import { isUpTriangle, triominoKey } from './model/triomino.model';
import { TriominoPresenter } from './triomino.presenter';
import { actionShortcut, interfaceShortcut } from '../../../engine/shortcuts/shortcut-utils';
import type { GameShortcutHint } from '../../../engine/shortcuts/game-shortcuts';

@Injectable()
export class TriominoService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'triomino';
  readonly category = 'JeuxDePlateaux';
  readonly subcategory = 'Les Vents Sacrés';
  readonly displayName = 'Triomino';
  readonly description = 'Placez des triominos sur une grille triangulaire en faisant correspondre les nombres.';
  readonly minPlayers = 2;
  readonly maxPlayers = 4;

  constructor(
    private readonly registry: GameRegistryService,
    private readonly random: RandomService,
    private readonly presenter: TriominoPresenter,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const scoresByPlayerId: Record<string, number> = {};
    const handsByPlayerId: Record<string, TriominoTile[]> = {};
    const selectedTileIdByPlayerId: Record<string, number | null> = {};
    for (const p of players) {
      if (!p?.id) continue;
      scoresByPlayerId[String(p.id)] = 0;
      handsByPlayerId[String(p.id)] = [];
      selectedTileIdByPlayerId[String(p.id)] = null;
    }

    const meta: TriominoMetadata = {
      rng: typeof baseState.metadata === 'object' && baseState.metadata ? (baseState.metadata as any).rng : undefined,
      size: 13,
      deck: [],
      handsByPlayerId,
      scoresByPlayerId,
      placedByKey: {},
      selectedTileIdByPlayerId,
      step: 'choose_tile',
      winnerId: null,
      ended: false,
    };

    const started = this.startGame(baseState, meta);
    return started;
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      next = this.applyOne(next, action);
    }
    return next;
  }

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];
    if (String(state.status ?? '').toLowerCase() !== 'started') return [];

    const meta = (state.metadata ?? {}) as TriominoMetadata;
    if ((meta.winnerId ?? null) != null || meta.ended) return [];

    const selectedId = (meta.selectedTileIdByPlayerId ?? {})[String(botPlayerId)] ?? null;
    if (selectedId) {
      const tile = this.findTileInHand(meta, botPlayerId, selectedId);
      if (!tile) {
        return [{ type: 'triomino_cancel', payload: {} }];
      }
      const placements = this.listPlacementActions(state, meta, botPlayerId, tile);
      const chosen = placements[0];
      return chosen ? [chosen] : [{ type: 'triomino_cancel', payload: {} }];
    }

    const hand = (meta.handsByPlayerId ?? {})[String(botPlayerId)] ?? [];
    for (const tile of hand) {
      if (!this.hasAnyLegalPlacement(meta, tile)) continue;
      const placements = this.listPlacementActions(state, meta, botPlayerId, tile);
      const chosen = placements[0];
      if (!chosen) continue;
      return [
        { type: 'triomino_select_tile', payload: { tileId: tile.id } },
        chosen,
      ];
    }

    if ((meta.deck ?? []).length > 0) {
      return [{ type: 'draw', payload: {} }];
    }

    return [{ type: 'triomino_pass', payload: {} }];
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    // Compute legal placement actions for the viewer/current player (stored temporarily in metadata for presenter).
    const meta = { ...(state.metadata ?? {}) } as TriominoMetadata;
    const current = state.turn?.currentPlayerId ?? null;
    if (current && (meta.selectedTileIdByPlayerId ?? {})[String(current)]) {
      const selectedId = (meta.selectedTileIdByPlayerId ?? {})[String(current)]!;
      const tile = this.findTileInHand(meta, current, selectedId);
      if (tile) {
        (meta as any).legalPlacementActionsByPlayerId = {
          ...(meta as any).legalPlacementActionsByPlayerId,
          [String(current)]: this.listPlacementActions(state, meta, current, tile),
        };
      }
    }
    return this.presenter.exposeStateForUser({ ...state, metadata: meta as any }, userId);
  }

  getShortcuts(ctx: any): GameShortcutHint[] {
    const meta = (ctx?.metadata ?? {}) as TriominoMetadata;
    const currentPlayerId = ctx?.currentPlayerId ?? null;
    if (!ctx?.started || !currentPlayerId) return [];
    const selected = (meta.selectedTileIdByPlayerId ?? {})[String(currentPlayerId)] ?? null;
    const info: GameShortcutHint[] = [
      interfaceShortcut('C', 'hand'),
      interfaceShortcut('P', 'position'),
      interfaceShortcut('S', 'score'),
      interfaceShortcut('A', 'play'),
      interfaceShortcut('B', 'table'),
    ];
    if (!selected) return info;
    return [...info, actionShortcut('ESC', 'triomino_cancel')];
  }

  private applyOne(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;

    const type = String(action?.type ?? '').trim();
    if (!type) return state;

    const actorId =
      typeof (action as any)?.meta?.actorId === 'number'
        ? (action as any).meta.actorId
        : state.turn?.currentPlayerId ?? null;
    if (!actorId) return state;

    const meta = { ...(state.metadata ?? {}) } as TriominoMetadata;
    if ((meta.winnerId ?? null) != null || meta.ended) return state;

    if (type === 'triomino_cancel') {
      const selected = (meta.selectedTileIdByPlayerId ?? {})[String(actorId)] ?? null;
      if (!selected) return state;
      const selectedTileIdByPlayerId = { ...(meta.selectedTileIdByPlayerId ?? {}) };
      selectedTileIdByPlayerId[String(actorId)] = null;
      return { ...state, metadata: { ...meta, selectedTileIdByPlayerId } as any };
    }

    const current = state.turn?.currentPlayerId ?? null;
    if (current !== actorId) return state;

    const selected = (meta.selectedTileIdByPlayerId ?? {})[String(actorId)] ?? null;

    if (!selected) {
      if (type === 'triomino_select_tile') {
        const tileId = Number((action.payload as any)?.tileId ?? 0);
        const tile = this.findTileInHand(meta, actorId, tileId);
        if (!tile) return state;
        if (!this.hasAnyLegalPlacement(meta, tile)) {
          const log = Array.isArray(state.log) ? [...state.log] : [];
          log.push({ message: `${this.playerName(state, actorId)} ne peut pas jouer ce triomino.` });
          return { ...state, log };
        }
        const selectedTileIdByPlayerId = { ...(meta.selectedTileIdByPlayerId ?? {}) };
        selectedTileIdByPlayerId[String(actorId)] = tileId;
        const log = Array.isArray(state.log) ? [...state.log] : [];
        log.push({ message: `${this.playerName(state, actorId)} sélectionne ${tile.a}-${tile.b}-${tile.c}.` });
        return { ...state, metadata: { ...meta, selectedTileIdByPlayerId } as any, log };
      }

      if (type === 'draw') {
        return this.applyDraw(state, meta, actorId);
      }

      if (type === 'triomino_pass') {
        return this.advanceTurn(state, meta, actorId, { message: `${this.playerName(state, actorId)} passe.` });
      }

      return state;
    }

    if (type === 'triomino_place') {
      const x = Number((action.payload as any)?.x);
      const y = Number((action.payload as any)?.y);
      const rot = Number((action.payload as any)?.rot);
      const tileId = Number((action.payload as any)?.tileId ?? selected);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rot)) return state;
      if (tileId !== selected) return state;
      const tile = this.findTileInHand(meta, actorId, tileId);
      if (!tile) return state;
      return this.applyPlace(state, meta, actorId, tile, x, y, rot as any);
    }

    return state;
  }

  private startGame(baseState: GameStateEntity, meta: TriominoMetadata): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const rngMeta = typeof meta.rng === 'object' && meta.rng ? { ...(meta.rng as any) } : {};
    const shuffled = this.random.shuffle(rngMeta, this.buildDeck());
    meta.rng = shuffled.meta;
    meta.deck = shuffled.values;

    // Deal 7 each.
    for (let i = 0; i < 7; i += 1) {
      for (const p of players) {
        if (!p?.id) continue;
        const tile = meta.deck.pop();
        if (!tile) continue;
        meta.handsByPlayerId[String(p.id)].push(tile);
      }
    }

    // Place starter tile in the center.
    const starter = meta.deck.pop();
    const center = Math.floor(meta.size / 2);
    if (starter) {
      meta.placedByKey[triominoKey(center, center)] = {
        tile: starter,
        ownerId: 0,
        rot: 0,
      };
    }

    const starterPlayerId = players[0]?.id ?? null;
    const log = Array.isArray(baseState.log) ? [...baseState.log] : [];
    log.push({ message: 'Triomino : début de partie.' });

    return {
      ...baseState,
      status: 'started',
      phase: 'play',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      pending: null,
      log,
      metadata: meta as any,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: starterPlayerId,
        direction: 1,
        label: starterPlayerId
          ? `Tour de ${players.find((p) => p?.id === starterPlayerId)?.username ?? `#${starterPlayerId}`}`
          : undefined,
      },
    };
  }

  private buildDeck(): TriominoTile[] {
    const tiles: TriominoTile[] = [];
    let id = 1;
    for (let a = 0; a <= 5; a += 1) {
      for (let b = a; b <= 5; b += 1) {
        for (let c = b; c <= 5; c += 1) {
          tiles.push({ id: id++, a, b, c });
        }
      }
    }
    return tiles;
  }

  private applyDraw(state: GameStateEntity, meta: TriominoMetadata, actorId: number): GameStateEntity {
    const deck = Array.isArray(meta.deck) ? [...meta.deck] : [];
    const tile = deck.pop();
    if (!tile) {
      return this.advanceTurn(state, { ...meta, deck }, actorId, { message: `${this.playerName(state, actorId)} ne peut pas piocher.` });
    }
    const handsByPlayerId = { ...(meta.handsByPlayerId ?? {}) };
    const hand = [...(handsByPlayerId[String(actorId)] ?? [])];
    hand.push(tile);
    handsByPlayerId[String(actorId)] = hand;
    const nextMeta: TriominoMetadata = { ...meta, deck, handsByPlayerId };
    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `${this.playerName(state, actorId)} pioche.` });
    return this.advanceTurn({ ...state, log }, nextMeta, actorId, null);
  }

  private applyPlace(
    state: GameStateEntity,
    meta: TriominoMetadata,
    actorId: number,
    tile: TriominoTile,
    x: number,
    y: number,
    rot: 0 | 1 | 2,
  ): GameStateEntity {
    const size = Number(meta.size ?? 0);
    if (x < 0 || y < 0 || x >= size || y >= size) return state;
    const key = triominoKey(x, y);
    if ((meta.placedByKey ?? {})[key]) return state;

    if (!this.isLegalPlacement(meta, tile, x, y, rot)) {
      return state;
    }

    const placedByKey = { ...(meta.placedByKey ?? {}) };
    placedByKey[key] = { tile, ownerId: actorId, rot };

    const handsByPlayerId = { ...(meta.handsByPlayerId ?? {}) };
    const hand = [...(handsByPlayerId[String(actorId)] ?? [])].filter((t) => t.id !== tile.id);
    handsByPlayerId[String(actorId)] = hand;

    const scoresByPlayerId = { ...(meta.scoresByPlayerId ?? {}) };
    const gained = tile.a + tile.b + tile.c;
    scoresByPlayerId[String(actorId)] = Number(scoresByPlayerId[String(actorId)] ?? 0) + gained;

    const selectedTileIdByPlayerId = { ...(meta.selectedTileIdByPlayerId ?? {}) };
    selectedTileIdByPlayerId[String(actorId)] = null;

    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `${this.playerName(state, actorId)} place ${tile.a}-${tile.b}-${tile.c} (+${gained}).` });

    const nextMeta: TriominoMetadata = {
      ...meta,
      placedByKey,
      handsByPlayerId,
      scoresByPlayerId,
      selectedTileIdByPlayerId,
    };

    if (hand.length === 0) {
      return this.finishGame(state, nextMeta, actorId, log);
    }

    return this.advanceTurn({ ...state, log }, nextMeta, actorId, null);
  }

  private finishGame(
    state: GameStateEntity,
    meta: TriominoMetadata,
    winnerId: number | null,
    log: any[],
  ): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    log.push({ message: 'Partie terminée.' });
    if (winnerId) {
      log.push({ message: `Gagnant : ${this.playerName(state, winnerId)}.` });
    }
    return {
      ...state,
      status: 'finished',
      log,
      metadata: {
        ...meta,
        winnerId,
        winnerPlayerId: winnerId,
        ended: true,
      } as any,
    };
  }

  private advanceTurn(
    state: GameStateEntity,
    meta: TriominoMetadata,
    actorId: number,
    extraLog: { message: string } | null,
  ): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const log = Array.isArray(state.log) ? [...state.log] : [];
    if (extraLog?.message) log.push(extraLog);

    const ids = players.map((p) => p?.id).filter((id) => typeof id === 'number') as number[];
    if (!ids.length) return { ...state, metadata: meta as any, log };
    const idx = Math.max(0, ids.indexOf(actorId));
    const nextPlayerId = ids[(idx + 1) % ids.length] ?? ids[0] ?? null;

    const nextState: GameStateEntity = {
      ...state,
      metadata: meta as any,
      log,
      turnIndex: (state.turnIndex ?? 0) + 1,
      turn: {
        ...(state.turn ?? { direction: 1 }),
        currentPlayerId: nextPlayerId,
        direction: 1,
        label: nextPlayerId
          ? `Tour de ${this.playerName(state, nextPlayerId)}`
          : undefined,
      },
    };

    // If deck empty and current player can't ever play, game might stall; detect terminal if nobody can play and no deck.
    if ((meta.deck ?? []).length <= 0 && this.noOneCanPlay(meta, ids)) {
      const winner = this.bestScoreWinnerId(meta, ids);
      return this.finishGame(nextState, meta, winner, log);
    }

    return nextState;
  }

  private noOneCanPlay(meta: TriominoMetadata, playerIds: number[]): boolean {
    for (const pid of playerIds) {
      const hand = (meta.handsByPlayerId ?? {})[String(pid)] ?? [];
      for (const tile of hand) {
        if (this.hasAnyLegalPlacement(meta, tile)) return false;
      }
    }
    return true;
  }

  private bestScoreWinnerId(meta: TriominoMetadata, playerIds: number[]): number | null {
    let bestId: number | null = null;
    let best = Number.NEGATIVE_INFINITY;
    for (const pid of playerIds) {
      const score = Number((meta.scoresByPlayerId ?? {})[String(pid)] ?? 0);
      if (score > best) {
        best = score;
        bestId = pid;
      }
    }
    return bestId;
  }

  private playerName(state: GameStateEntity, id: number): string {
    return state.players?.find((p) => p?.id === id)?.username ?? `#${id}`;
  }

  private findTileInHand(meta: TriominoMetadata, playerId: number, tileId: number): TriominoTile | null {
    const hand = (meta.handsByPlayerId ?? {})[String(playerId)] ?? [];
    return hand.find((t) => t.id === tileId) ?? null;
  }

  private listPlacementActions(
    state: GameStateEntity,
    meta: TriominoMetadata,
    playerId: number,
    tile: TriominoTile,
  ): GameSingleActionDto[] {
    const size = Number(meta.size ?? 0);
    const candidates = this.listCandidateEmptyCells(meta, size);
    const out: GameSingleActionDto[] = [];
    for (const [x, y] of candidates) {
      for (const rot of [0, 1, 2] as const) {
        if (!this.isLegalPlacement(meta, tile, x, y, rot)) continue;
        out.push({
          type: 'triomino_place',
          payload: { x, y, rot, tileId: tile.id, _ui: { key: 'ENTER', kind: 'place' } },
        });
      }
    }
    return out;
  }

  private listCandidateEmptyCells(meta: TriominoMetadata, size: number): Array<[number, number]> {
    const placedKeys = Object.keys(meta.placedByKey ?? {});
    const out = new Set<string>();
    for (const key of placedKeys) {
      const [xs, ys] = key.split(',');
      const x = Number(xs);
      const y = Number(ys);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      for (const [nx, ny] of this.neighbors(x, y)) {
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const k = triominoKey(nx, ny);
        if ((meta.placedByKey ?? {})[k]) continue;
        out.add(k);
      }
    }
    return [...out].map((k) => {
      const [xs, ys] = k.split(',');
      return [Number(xs), Number(ys)] as [number, number];
    });
  }

  private hasAnyLegalPlacement(meta: TriominoMetadata, tile: TriominoTile): boolean {
    const size = Number(meta.size ?? 0);
    const candidates = this.listCandidateEmptyCells(meta, size);
    for (const [x, y] of candidates) {
      for (const rot of [0, 1, 2] as const) {
        if (this.isLegalPlacement(meta, tile, x, y, rot)) return true;
      }
    }
    return false;
  }

  private isLegalPlacement(meta: TriominoMetadata, tile: TriominoTile, x: number, y: number, rot: 0 | 1 | 2): boolean {
    const size = Number(meta.size ?? 0);
    if (x < 0 || y < 0 || x >= size || y >= size) return false;
    const key = triominoKey(x, y);
    if ((meta.placedByKey ?? {})[key]) return false;

    // Must touch at least one existing tile.
    const neighbors = this.neighbors(x, y);
    let touches = false;
    for (const [nx, ny] of neighbors) {
      const other = (meta.placedByKey ?? {})[triominoKey(nx, ny)];
      if (other) {
        touches = true;
        if (!this.edgesMatch(tile, rot, x, y, other.tile, other.rot, nx, ny)) {
          return false;
        }
      }
    }
    return touches;
  }

  private neighbors(x: number, y: number): Array<[number, number]> {
    if (isUpTriangle(x, y)) {
      return [
        [x - 1, y],
        [x + 1, y],
        [x, y + 1],
      ];
    }
    return [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
    ];
  }

  private rotateNumbers(tile: TriominoTile, rot: 0 | 1 | 2): [number, number, number] {
    const base: [number, number, number] = [tile.a, tile.b, tile.c];
    if (rot === 0) return base;
    if (rot === 1) return [base[1], base[2], base[0]];
    return [base[2], base[0], base[1]];
  }

  private edgeFor(x: number, y: number, rotNumbers: [number, number, number], edge: 'L' | 'R' | 'V'): number {
    // Edge mapping per triangle orientation:
    // Up triangle uses: L, R, V=bottom
    // Down triangle uses: L, R, V=top
    // We store numbers in [L, R, V] order (after rotation).
    // This is a simplification but gives consistent matching.
    if (edge === 'L') return rotNumbers[0];
    if (edge === 'R') return rotNumbers[1];
    return rotNumbers[2];
  }

  private edgesMatch(
    tileA: TriominoTile,
    rotA: 0 | 1 | 2,
    ax: number,
    ay: number,
    tileB: TriominoTile,
    rotB: 0 | 1 | 2,
    bx: number,
    by: number,
  ): boolean {
    const a = this.rotateNumbers(tileA, rotA);
    const b = this.rotateNumbers(tileB, rotB);

    // Determine which shared edge is used.
    if (bx === ax - 1 && by === ay) {
      // B is left of A.
      return this.edgeFor(ax, ay, a, 'L') === this.edgeFor(bx, by, b, 'R');
    }
    if (bx === ax + 1 && by === ay) {
      // B is right of A.
      return this.edgeFor(ax, ay, a, 'R') === this.edgeFor(bx, by, b, 'L');
    }
    if (bx === ax && by === ay + 1) {
      // B is below A.
      return this.edgeFor(ax, ay, a, 'V') === this.edgeFor(bx, by, b, 'V');
    }
    if (bx === ax && by === ay - 1) {
      // B is above A.
      return this.edgeFor(ax, ay, a, 'V') === this.edgeFor(bx, by, b, 'V');
    }
    return true;
  }
}
