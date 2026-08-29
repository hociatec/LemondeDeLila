import {
  defineEvent,
  gameInput,
  playerId as toPlayerId,
  rollDice,
  type GameContext,
  type PlayerMap,
} from '../../../engine/sdk/public-api';
import type { PrimalisFace, PrimalisResources, PrimalisState } from './state';

const TRACK = 'comet';
export const PRIMALIS_DANGER_AMPLIFIED = 'primalis.danger-amplified';
type RuleContext = GameContext<PrimalisState>;
const PRIMALIS_FACES: readonly PrimalisFace[] = [
  'herbivore',
  'carnivore',
  'egg',
  'leaf',
  'danger',
  'herbivore',
];
const ROLL_RESOLVED = defineEvent({
  type: 'primalis.roll.resolved',
  data: gameInput.object({
    playerId: gameInput.playerId(),
    value: gameInput.number({ integer: true }),
    face: gameInput.enum(PRIMALIS_FACES),
  }),
});

export const roll = rollDice<PrimalisState>({
  policy: { reroll: { while: ({ total }) => total === 6, max: 1 } },
  execute: ({ state, playerId, total, ctx }) => {
    const face = faceFromRoll(total);
    applyFace(playerId, face, ctx);
    const position = ctx.movement.move(TRACK, playerId, 1);
    applyTile(state, playerId, position, face, ctx);
    if (face === 'danger') applyDanger(state, position, ctx);
    ROLL_RESOLVED.emit(ctx, {
      playerId: toPlayerId(playerId),
      value: total,
      face,
    });
    ctx.turn.complete();
  },
});

export const PRIMALIS_ACTIONS = { roll };

export function score(resources: PrimalisResources): number {
  return resources.herbivores + resources.carnivores + resources.leaves;
}

export function winnerByResources(
  collections: Readonly<PlayerMap<PrimalisResources>>,
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

export function faceFromRoll(value: number): PrimalisFace {
  return PRIMALIS_FACES[Math.max(0, Math.min(5, value - 1))] ?? 'herbivore';
}

function applyFace(
  playerId: number,
  face: PrimalisFace,
  ctx: RuleContext,
): void {
  if (face === 'danger') return;
  if (face === 'egg') {
    const resource =
      ctx.resources.get(playerId, 'herbivores') >=
      ctx.resources.get(playerId, 'carnivores')
        ? 'herbivores'
        : 'carnivores';
    ctx.resources.add(playerId, resource, 1);
  } else if (face === 'herbivore') ctx.resources.add(playerId, 'herbivores', 1);
  else if (face === 'carnivore') ctx.resources.add(playerId, 'carnivores', 1);
  else if (face === 'leaf') ctx.resources.add(playerId, 'leaves', 1);
}

function applyTile(
  _state: PrimalisState,
  playerId: number,
  tile: number,
  face: PrimalisFace,
  ctx: RuleContext,
): void {
  if (tile === 1 && (face === 'egg' || face === 'leaf')) {
    ctx.resources.add(playerId, face === 'egg' ? 'eggs' : 'leaves', 1);
    ctx.events.message('primalis.harvest.doubled', { playerId, face });
  } else if (
    tile === 2 &&
    ctx.resources.get(playerId, 'carnivores') >
      ctx.resources.get(playerId, 'herbivores')
  ) {
    if (ctx.resources.has(playerId, 'herbivores', 1)) {
      ctx.resources.remove(playerId, 'herbivores', 1);
    }
  } else if (tile === 3 && face === 'leaf')
    ctx.resources.add(playerId, 'leaves', 1);
  else if (tile === 4 && face === 'carnivore')
    ctx.resources.add(playerId, 'eggs', 1);
  else if (tile === 6) ctx.counters.set(PRIMALIS_DANGER_AMPLIFIED, 1);
  else if (tile === 7) ctx.resources.add(playerId, 'leaves', 1);
  else if (tile === 8 && (face === 'herbivore' || face === 'carnivore')) {
    ctx.resources.add(playerId, 'leaves', 1);
  }
}

function applyDanger(
  _state: PrimalisState,
  tile: number,
  ctx: RuleContext,
): void {
  ctx.events.message('primalis.danger.triggered', { tileId: tile });
  const distance =
    1 +
    (ctx.counters.get(PRIMALIS_DANGER_AMPLIFIED) > 0 ? 1 : 0) +
    (tile === 9 ? 1 : 0);
  for (const player of ctx.players.all())
    ctx.movement.move(TRACK, player.id, distance);
  ctx.counters.set(PRIMALIS_DANGER_AMPLIFIED, 0);
}

export function primalisCollections(
  ctx: RuleContext,
): PlayerMap<PrimalisResources> {
  return ctx.players.byId((player) => ({
    herbivores: ctx.resources.get(player.id, 'herbivores'),
    carnivores: ctx.resources.get(player.id, 'carnivores'),
    eggs: ctx.resources.get(player.id, 'eggs'),
    leaves: ctx.resources.get(player.id, 'leaves'),
  }));
}
