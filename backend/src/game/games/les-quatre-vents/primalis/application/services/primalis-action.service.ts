import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../models/game-action.model';
import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';

import { GameCoreService } from '../../../../../application/services/game-core.service';
import { RandomService } from '../../../../../application/services/random.service';
import { TurnFlowService } from '../../../../../application/services/turn-flow.service';
import type {
  PrimalisMetadata,
  PrimalisResources,
  PrimalisTile,
} from '../../model/primalis-state.model';
import {
  applyActionsSequentially,
  dispatchByActionType,
  normalizeActionType,
} from '../../../../../application/helpers/action-service.helper';
import {
  asPrimalisPartialMeta,
  computePrimalisScore,
  determinePrimalisDuplicate,
  getPrimalisResources,
  mapPrimalisFace,
  type PrimalisFace,
} from './primalis-action.utils';

export class PrimalisActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
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
          roll: () => {
            next = this.handleRoll(next);
            return next;
          },
        },
        () => next,
      );
    });
    return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;

    const playerId = state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    if (state.pending) return state;

    const meta = this.getMeta(state);
    const rng = this.random.rollDice(meta as Record<string, unknown>, 6);
    let face = mapPrimalisFace(rng.roll);
    let nextMeta: PrimalisMetadata = {
      ...meta,
      ...asPrimalisPartialMeta(rng.meta),
    };
    let next: GameStateEntity = {
      ...state,
      lastRoll: rng.roll,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} lance le dÃƒÆ’Ã‚Â© : "${rng.roll}".`,
    );

    if (face === 'relance') {
      const reroll = this.random.rollDice(nextMeta, 6);
      face = mapPrimalisFace(reroll.roll);
      nextMeta = { ...nextMeta, ...asPrimalisPartialMeta(reroll.meta) };
      next = {
        ...next,
        lastRoll: reroll.roll,
        metadata: { ...(next.metadata ?? {}), ...nextMeta },
      };
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} utilise la relance et obtient "${reroll.roll}".`,
      );
    }

    next = this.applyFaceEffect(next, playerId, face);
    next = this.advancePlayer(next, playerId);
    next = this.checkFinish(next);

    const tile = this.getTileForPlayer(next, playerId);
    next = this.applyTileEffects(next, playerId, tile, face);

    if (face === 'danger') {
      next = this.applyDanger(next, playerId, tile);
      next = this.checkFinish(next);
    }

    const updatedMeta = this.getMeta(next);
    if (updatedMeta.winnerId != null) {
      return { ...next, status: 'finished' };
    }

    return this.turns.advanceTurn(next);
  }

  private applyFaceEffect(
    state: GameStateEntity,
    playerId: number,
    face: PrimalisFace,
  ): GameStateEntity {
    if (face === 'danger' || face === 'relance') {
      return state;
    }
    if (face === 'egg') {
      const resources = this.getResources(state, playerId);
      return this.addResources(
        state,
        playerId,
        determinePrimalisDuplicate(resources),
      );
    }
    const resource =
      face === 'herbivore'
        ? { herbivores: 1 }
        : face === 'carnivore'
          ? { carnivores: 1 }
          : face === 'leaf'
            ? { leaves: 1 }
            : null;
    if (!resource) return state;
    return this.addResources(state, playerId, resource);
  }

  private applyTileEffects(
    state: GameStateEntity,
    playerId: number,
    tile: PrimalisTile | null,
    face: PrimalisFace,
  ): GameStateEntity {
    if (!tile) return state;
    let next = state;
    const resources = this.getResources(next, playerId);

    switch (tile.n) {
      case 1:
        if (face === 'egg' || face === 'leaf') {
          const addition = face === 'egg' ? { eggs: 1 } : { leaves: 1 };
          next = this.addResources(next, playerId, addition);
          next = this.core.appendLog(
            next,
            `${resolvePlayerNameFromState(next, playerId)} double sa rÃƒÆ’Ã‚Â©colte sur la case 1.`,
          );
        }
        break;
      case 2:
        if (resources.carnivores > resources.herbivores) {
          next = this.addResources(next, playerId, { herbivores: -1 });
          next = this.core.appendLog(
            next,
            `${resolvePlayerNameFromState(next, playerId)} perd un herbivore (case 2).`,
          );
        }
        break;
      case 3:
        if (face === 'leaf') {
          next = this.addResources(next, playerId, { leaves: 1 });
          next = this.core.appendLog(
            next,
            `${resolvePlayerNameFromState(next, playerId)} gagne une feuille supplÃƒÆ’Ã‚Â©mentaire (case 3).`,
          );
        }
        break;
      case 4:
        if (face === 'carnivore') {
          next = this.addResources(next, playerId, { eggs: 1 });
          next = this.core.appendLog(
            next,
            `${resolvePlayerNameFromState(next, playerId)} rÃƒÆ’Ã‚Â©cupÃƒÆ’Ã‚Â¨re un Ãƒâ€¦Ã¢â‚¬Å“uf bonus (case 4).`,
          );
        }
        break;
      case 6:
        next = this.enableDangerAmplification(next);
        break;
      case 7:
        next = this.addResources(next, playerId, { leaves: 1 });
        next = this.core.appendLog(
          next,
          `${resolvePlayerNameFromState(next, playerId)} collecte une feuille magique (case 7).`,
        );
        break;
      case 8:
        if (face === 'herbivore' || face === 'carnivore') {
          next = this.addResources(next, playerId, { leaves: 1 });
          next = this.core.appendLog(
            next,
            `${resolvePlayerNameFromState(next, playerId)} transforme sa relance en feuilles (case 8).`,
          );
        }
        break;
      case 9:
        break;
      default:
    }
    return next;
  }

  private applyDanger(
    state: GameStateEntity,
    playerId: number,
    tile: PrimalisTile | null,
  ): GameStateEntity {
    let next = state;
    next = this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} dÃƒÆ’Ã‚Â©clenche un Danger : la comÃƒÆ’Ã‚Â¨te avance.`,
    );
    next = this.advanceAllPlayers(next, 1);
    if (this.getMeta(next).statuses.dangerAmplified) {
      next = this.core.appendLog(
        next,
        'La case 6 amplifie le Danger : tout le monde avance encore.',
      );
      next = this.advanceAllPlayers(next, 1);
      next = this.disableDangerAmplification(next);
    }
    if (tile?.n === 9) {
      next = this.core.appendLog(
        next,
        'Case 9 : le Danger est amplifiÃƒÆ’Ã‚Â©, tout le monde avance de deux cases supplÃƒÆ’Ã‚Â©mentaires.',
      );
      next = this.advanceAllPlayers(next, 1);
    }
    return next;
  }

  private advancePlayer(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const current = meta.positions?.[playerId] ?? 0;
    const tiles = meta.tiles ?? [];
    const nextPos = Math.min(
      tiles.length ? tiles[tiles.length - 1].n : 0,
      current + 1,
    );
    return this.setPosition(state, playerId, nextPos);
  }

  private advanceAllPlayers(
    state: GameStateEntity,
    delta: number,
  ): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);
    const tiles = meta.tiles ?? [];
    const maxPos = tiles.length ? tiles[tiles.length - 1].n : 0;
    const positions = { ...(meta.positions ?? {}) };
    for (const key of Object.keys(positions)) {
      const id = Number(key);
      if (!Number.isFinite(id)) continue;
      const current = positions[id] ?? 0;
      positions[id] = Math.min(maxPos, current + delta);
    }
    next = {
      ...next,
      metadata: { ...(next.metadata ?? {}), ...meta, positions },
    };
    return next;
  }

  private addResources(
    state: GameStateEntity,
    playerId: number,
    adjustments: Partial<PrimalisResources>,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const resources = this.getResources(state, playerId);
    const updated: PrimalisResources = {
      herbivores: Math.max(
        0,
        resources.herbivores + (adjustments.herbivores ?? 0),
      ),
      carnivores: Math.max(
        0,
        resources.carnivores + (adjustments.carnivores ?? 0),
      ),
      eggs: Math.max(0, resources.eggs + (adjustments.eggs ?? 0)),
      leaves: Math.max(0, resources.leaves + (adjustments.leaves ?? 0)),
    };
    const collections = { ...(meta.collections ?? {}), [playerId]: updated };
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, collections },
    };
  }

  private finishGame(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const entries = Object.entries(meta.collections ?? {}).map(
      ([id, resources]) => ({
        id: Number(id),
        resources,
      }),
    );
    let best = entries[0];
    for (const entry of entries) {
      if (!best) {
        best = entry;
        continue;
      }
      const score = computePrimalisScore(entry.resources);
      const bestScore = computePrimalisScore(best.resources);
      if (score > bestScore) {
        best = entry;
      } else if (score === bestScore) {
        if ((entry.resources.leaves ?? 0) > (best.resources.leaves ?? 0)) {
          best = entry;
        } else if (
          entry.resources.leaves === best.resources.leaves &&
          (entry.resources.eggs ?? 0) > (best.resources.eggs ?? 0)
        ) {
          best = entry;
        }
      }
    }
    if (!best) {
      return state;
    }
    const next: GameStateEntity = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        winnerId: best.id,
      },
      status: 'finished',
    };
    return this.core.appendLog(
      next,
      `${resolvePlayerNameFromState(next, best.id)} survit ÃƒÆ’Ã‚Â  la comÃƒÆ’Ã‚Â¨te avec ${
        best.resources.herbivores + best.resources.carnivores
      } dinosaures et ${best.resources.leaves} feuilles.`,
    );
  }

  private setPosition(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const positions = { ...(meta.positions ?? {}), [playerId]: pos };
    const nextMeta: PrimalisMetadata = { ...meta, positions };
    return { ...state, metadata: { ...nextMeta } };
  }

  private getTileForPlayer(
    state: GameStateEntity,
    playerId: number,
  ): PrimalisTile | null {
    const meta = this.getMeta(state);
    const pos = meta.positions?.[playerId] ?? 0;
    return meta.tiles?.find((tile) => tile.n === pos) ?? null;
  }

  private getResources(
    state: GameStateEntity,
    playerId: number,
  ): PrimalisResources {
    return getPrimalisResources(this.getMeta(state), playerId);
  }

  private enableDangerAmplification(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const statuses = { ...meta.statuses, dangerAmplified: true };
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, statuses },
    };
  }

  private disableDangerAmplification(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const statuses = { ...meta.statuses, dangerAmplified: false };
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, statuses },
    };
  }

  private getMeta(state: GameStateEntity): PrimalisMetadata {
    return (state.metadata ?? {}) as PrimalisMetadata;
  }

  private checkFinish(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const tiles = meta.tiles ?? [];
    if (!tiles.length) return state;
    const last = tiles[tiles.length - 1].n;
    for (const player of state.players ?? []) {
      if (!player?.id) continue;
      const pos = meta.positions?.[player.id] ?? 0;
      if (pos >= last) {
        return this.finishGame(state);
      }
    }
    return state;
  }
}









