import { defineAction, gameInput } from '../../../core/application/public-api';
import type { PrimalisFace, PrimalisResources, PrimalisState } from './state';

const TRACK = 'comet';

export const roll = defineAction<PrimalisState, Record<string, never>>({
  input: gameInput.object({}),
  execute: ({ state, actor, ctx }) => {
    let value = ctx.dice.roll('main').total;
    if (value === 6) value = ctx.dice.roll('main').total;
    const face = faceFromRoll(value);
    state.lastRoll = value;
    state.lastFace = face;
    ctx.history.add(`${actor.username} lance le dé : « ${value} ».`);
    applyFace(state, actor.id, face);
    const position = ctx.movement.move(TRACK, actor.id, 1);
    applyTile(state, actor.id, position, face, ctx.history.add);
    if (face === 'danger') applyDanger(state, position, ctx);
    ctx.events.emit('primalis.roll.resolved', {
      playerId: actor.id,
      value,
      face,
    });
    ctx.turn.end();
  },
});

export const PRIMALIS_ACTIONS = { roll };

export function score(resources: PrimalisResources): number {
  return resources.herbivores + resources.carnivores + resources.leaves;
}

export function winnerByResources(
  collections: Readonly<Record<number, PrimalisResources>>,
): number | null {
  return (
    Object.entries(collections)
      .map(([playerId, resources]) => ({
        playerId: Number(playerId),
        resources,
      }))
      .sort(
        (left, right) =>
          score(right.resources) - score(left.resources) ||
          right.resources.leaves - left.resources.leaves ||
          right.resources.eggs - left.resources.eggs,
      )[0]?.playerId ?? null
  );
}

function faceFromRoll(value: number): PrimalisFace {
  return ['herbivore', 'carnivore', 'egg', 'leaf', 'danger', 'herbivore'][
    Math.max(0, Math.min(5, value - 1))
  ] as PrimalisFace;
}

function applyFace(
  state: PrimalisState,
  playerId: number,
  face: PrimalisFace,
): void {
  if (face === 'danger') return;
  const resources = state.collections[playerId];
  if (face === 'egg') {
    if (resources.herbivores >= resources.carnivores) resources.herbivores += 1;
    else resources.carnivores += 1;
  } else if (face === 'herbivore') resources.herbivores += 1;
  else if (face === 'carnivore') resources.carnivores += 1;
  else if (face === 'leaf') resources.leaves += 1;
}

function applyTile(
  state: PrimalisState,
  playerId: number,
  tile: number,
  face: PrimalisFace,
  log: (message: string) => void,
): void {
  const resources = state.collections[playerId];
  if (tile === 1 && (face === 'egg' || face === 'leaf')) {
    if (face === 'egg') resources.eggs += 1;
    else resources.leaves += 1;
    log('La case 1 double la récolte.');
  } else if (tile === 2 && resources.carnivores > resources.herbivores) {
    resources.herbivores = Math.max(0, resources.herbivores - 1);
  } else if (tile === 3 && face === 'leaf') resources.leaves += 1;
  else if (tile === 4 && face === 'carnivore') resources.eggs += 1;
  else if (tile === 6) state.dangerAmplified = true;
  else if (tile === 7) resources.leaves += 1;
  else if (tile === 8 && (face === 'herbivore' || face === 'carnivore')) {
    resources.leaves += 1;
  }
}

function applyDanger(
  state: PrimalisState,
  tile: number,
  ctx: {
    players: { all(): Array<{ id: number }> };
    movement: {
      move(trackId: string, playerId: number, distance: number): number;
    };
    history: { add(message: string): void };
  },
): void {
  ctx.history.add('Danger : la comète avance pour toutes les tribus.');
  const distance = 1 + (state.dangerAmplified ? 1 : 0) + (tile === 9 ? 1 : 0);
  for (const player of ctx.players.all())
    ctx.movement.move(TRACK, player.id, distance);
  state.dangerAmplified = false;
}
