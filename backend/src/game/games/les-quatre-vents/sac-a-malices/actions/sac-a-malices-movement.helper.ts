import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { SacMetadata, SacTile } from '../model/sac-a-malices.types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function moveSacAMalicesForward(input: {
  state: GameStateEntity;
  playerId: number;
  delta: number;
  getMeta: (state: GameStateEntity) => SacMetadata;
  getRules: (
    meta: SacMetadata,
  ) => NonNullable<SacMetadata['rules']>;
  setPos: (state: GameStateEntity, playerId: number, pos: number) => GameStateEntity;
  addMoney: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    options: { toPot: boolean },
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const rules = input.getRules(meta);
  const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
  const len = tiles.length || 40;
  const pos = meta.positions?.[input.playerId] ?? 0;
  const nextPos = (((pos + input.delta) % len) + len) % len;
  let next = input.setPos(input.state, input.playerId, nextPos);
  if (input.delta > 0 && nextPos < pos) {
    next = input.appendLog(
      next,
      `Passage sur Départ : +${rules.passStartBonus} €.`,
    );
    next = input.addMoney(next, input.playerId, rules.passStartBonus, {
      toPot: false,
    });
  }
  return next;
}

export function moveSacAMalicesTo(input: {
  state: GameStateEntity;
  playerId: number;
  pos: number;
  collectStart: boolean;
  getMeta: (state: GameStateEntity) => SacMetadata;
  getRules: (
    meta: SacMetadata,
  ) => NonNullable<SacMetadata['rules']>;
  setPos: (state: GameStateEntity, playerId: number, pos: number) => GameStateEntity;
  addMoney: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    options: { toPot: boolean },
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const rules = input.getRules(meta);
  const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
  const len = tiles.length || 40;
  const current = meta.positions?.[input.playerId] ?? 0;
  const target = clamp(input.pos, 0, len - 1);
  let next = input.setPos(input.state, input.playerId, target);
  if (input.collectStart && target < current) {
    next = input.appendLog(
      next,
      `Passage sur Départ : +${rules.passStartBonus} €.`,
    );
    next = input.addMoney(next, input.playerId, rules.passStartBonus, {
      toPot: false,
    });
  }
  return next;
}

export function sendSacAMalicesToJail(input: {
  state: GameStateEntity;
  playerId: number;
  getMeta: (state: GameStateEntity) => SacMetadata;
  getRules: (
    meta: SacMetadata,
  ) => NonNullable<SacMetadata['rules']>;
  setPos: (state: GameStateEntity, playerId: number, pos: number) => GameStateEntity;
  setJailTurns: (
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ) => GameStateEntity;
  findJailTile: (tiles: SacTile[] | undefined) => number | null;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const rules = input.getRules(meta);
  const jailPos = input.findJailTile(meta.tiles) ?? 30;
  let next = input.setPos(input.state, input.playerId, jailPos);
  next = input.setJailTurns(next, input.playerId, rules.jail.maxTurns);
  return next;
}




