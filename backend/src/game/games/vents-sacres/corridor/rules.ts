import {
  rejectRule,
  defineAction,
  gameInput,
  sequentialPawnSelection,
  setupPlayingPhases,
} from '../../../engine/sdk/public-api';
import type {
  GameContext,
  NoGameState,
  PlayerMap,
} from '../../../engine/sdk/public-api';
import { CORRIDOR_SIZE } from './content';
import type {
  CorridorOrientation,
  CorridorPosition,
  CorridorWall,
} from './types';

type CorridorState = NoGameState;
type RuleContext = GameContext<CorridorState>;
export const CORRIDOR_PHASES = setupPlayingPhases<CorridorState>();
export const CORRIDOR_WALLS = 'corridor.walls';
const DIRECTIONS: CorridorPosition[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export const move = defineAction<CorridorState, CorridorPosition>({
  input: gameInput.object({
    x: gameInput.number({ integer: true, min: 0, max: 8 }),
    y: gameInput.number({ integer: true, min: 0, max: 8 }),
  }),
  documentation: 'Déplace le pion sur une case légale, saut compris.',
  available: ({ ctx }) => CORRIDOR_PHASES.is(ctx, 'playing'),
  validate: ({ state, actor, input, ctx }) =>
    legalMoves(state, actor.id, ctx).some((position) => same(position, input)),
  enumerate: ({ state, actor, ctx }) => legalMoves(state, actor.id, ctx),
  execute: ({ state, actor, input, ctx }) => {
    if (
      !legalMoves(state, actor.id, ctx).some((position) =>
        same(position, input),
      )
    ) {
      rejectRule('Déplacement Corridor illégal');
    }
    const from = corridorPositions(ctx)[actor.id];
    ctx.grid.clear('corridor', from);
    ctx.grid.set('corridor', input, actor.id);
    if (input.y === goalY(actor.id, ctx)) {
      ctx.match.finish({ winners: [actor.id], reason: 'opposite-edge' });
    } else {
      ctx.turn.end();
    }
  },
});

export const placeWall = defineAction<
  CorridorState,
  { x: number; y: number; orientation: CorridorOrientation }
>({
  input: gameInput.object({
    x: gameInput.number({ integer: true, min: 0, max: 7 }),
    y: gameInput.number({ integer: true, min: 0, max: 7 }),
    orientation: gameInput.enum(['h', 'v'] as const),
  }),
  documentation: 'Place un mur sans chevauchement et sans fermer un chemin.',
  available: ({ actor, ctx }) =>
    CORRIDOR_PHASES.is(ctx, 'playing') &&
    ctx.resources.get(actor.id, CORRIDOR_WALLS) > 0,
  validate: ({ state, actor, input, ctx }) =>
    legalWalls(state, actor.id, ctx).some((wall) => sameWall(wall, input)),
  enumerate: ({ state, actor, ctx }) => legalWalls(state, actor.id, ctx),
  execute: ({ state, actor, input, ctx }) => {
    if (
      !legalWalls(state, actor.id, ctx).some((wall) => sameWall(wall, input))
    ) {
      rejectRule('Placement de mur Corridor illégal');
    }
    ctx.grid.appendOverlay('corridor', 'walls', input);
    ctx.resources.remove(actor.id, CORRIDOR_WALLS, 1);
    ctx.turn.end();
  },
});

export const CORRIDOR_ACTIONS = {
  corridor_move: move,
  corridor_place_wall: placeWall,
};

const pawnSelection = sequentialPawnSelection<CorridorState>({
  setId: 'corridor',
  choiceId: 'corridor.pawn',
  complete: ({ ctx }) => {
    CORRIDOR_PHASES.transition(ctx, 'playing');
    const first = ctx.players.all()[0];
    if (first) ctx.turn.to(first.id);
  },
});

export function startCorridorSetup(
  wallsPerPlayer: number,
  ctx: RuleContext,
): void {
  if (
    !Number.isInteger(wallsPerPlayer) ||
    wallsPerPlayer < 0 ||
    wallsPerPlayer > 20
  ) {
    rejectRule('Nombre de murs Corridor invalide');
  }
  for (const player of ctx.players.all())
    ctx.resources.set(player.id, CORRIDOR_WALLS, wallsPerPlayer);
  const first = ctx.players.all()[0];
  if (first) {
    ctx.turn.to(first.id);
    pawnSelection.request(first.id, ctx);
  }
}

export const resolvePawn = pawnSelection.resolve;

export function legalMoves(
  _state: CorridorState,
  actorId: number,
  ctx: RuleContext,
): CorridorPosition[] {
  const positions = corridorPositions(ctx);
  const from = positions[actorId];
  const opponent = ctx.players.all().find((player) => player.id !== actorId);
  const opponentPosition = opponent ? positions[opponent.id] : null;
  const results: CorridorPosition[] = [];
  for (const direction of DIRECTIONS) {
    const step = add(from, direction);
    if (!inside(step) || edgeBlocked(corridorWalls(ctx), from, step)) continue;
    if (opponentPosition && same(step, opponentPosition)) {
      const jump = add(step, direction);
      if (inside(jump) && !edgeBlocked(corridorWalls(ctx), step, jump)) {
        results.push(jump);
      } else {
        const sides =
          direction.x === 0
            ? [
                { x: -1, y: 0 },
                { x: 1, y: 0 },
              ]
            : [
                { x: 0, y: -1 },
                { x: 0, y: 1 },
              ];
        for (const side of sides) {
          const diagonal = add(step, side);
          if (
            inside(diagonal) &&
            !edgeBlocked(corridorWalls(ctx), step, diagonal)
          ) {
            results.push(diagonal);
          }
        }
      }
    } else if (
      !Object.values(positions).some((position) => same(position, step))
    ) {
      results.push(step);
    }
  }
  return uniquePositions(results);
}

export function legalWalls(
  _state: CorridorState,
  actorId: number,
  ctx: RuleContext,
): CorridorWall[] {
  if (ctx.resources.get(actorId, CORRIDOR_WALLS) <= 0) return [];
  const walls: CorridorWall[] = [];
  for (const orientation of ['h', 'v'] as const) {
    for (let y = 0; y < CORRIDOR_SIZE - 1; y += 1) {
      for (let x = 0; x < CORRIDOR_SIZE - 1; x += 1) {
        const wall = { x, y, orientation };
        const existingWalls = corridorWalls(ctx);
        if (overlaps(existingWalls, wall)) continue;
        const candidate = [...existingWalls, wall];
        if (
          ctx.players
            .all()
            .every((player) =>
              hasPath(
                candidate,
                corridorPositions(ctx)[player.id],
                goalY(player.id, ctx),
              ),
            )
        ) {
          walls.push(wall);
        }
      }
    }
  }
  return walls;
}

function hasPath(
  walls: readonly CorridorWall[],
  start: CorridorPosition,
  goalY: number,
): boolean {
  const queue = [start];
  const seen = new Set([key(start)]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.y === goalY) return true;
    for (const direction of DIRECTIONS) {
      const next = add(current, direction);
      if (!inside(next) || edgeBlocked(walls, current, next)) continue;
      const id = key(next);
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(next);
    }
  }
  return false;
}

function edgeBlocked(
  walls: readonly CorridorWall[],
  from: CorridorPosition,
  to: CorridorPosition,
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return true;
  if (dy !== 0) {
    const y = Math.min(from.y, to.y);
    return walls.some(
      (wall) =>
        wall.orientation === 'h' &&
        wall.y === y &&
        (wall.x === from.x || wall.x + 1 === from.x),
    );
  }
  const x = Math.min(from.x, to.x);
  return walls.some(
    (wall) =>
      wall.orientation === 'v' &&
      wall.x === x &&
      (wall.y === from.y || wall.y + 1 === from.y),
  );
}

function overlaps(walls: readonly CorridorWall[], wall: CorridorWall): boolean {
  return walls.some((existing) => {
    if (
      existing.x === wall.x &&
      existing.y === wall.y &&
      existing.orientation !== wall.orientation
    ) {
      return true;
    }
    if (existing.orientation !== wall.orientation) return false;
    return wall.orientation === 'h'
      ? existing.y === wall.y && Math.abs(existing.x - wall.x) <= 1
      : existing.x === wall.x && Math.abs(existing.y - wall.y) <= 1;
  });
}

function corridorWalls(ctx: RuleContext): readonly CorridorWall[] {
  return ctx.grid.overlays<CorridorWall>('corridor', 'walls');
}

function inside(position: CorridorPosition): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < CORRIDOR_SIZE &&
    position.y < CORRIDOR_SIZE
  );
}

export function corridorPositions(
  ctx: RuleContext,
): PlayerMap<CorridorPosition> {
  return Object.fromEntries(
    ctx.grid
      .entries<number>('corridor')
      .map(({ position, value: playerId }) => [playerId, position]),
  );
}

export function corridorWallsRemaining(ctx: RuleContext): PlayerMap<number> {
  return ctx.players.byId((player) =>
    ctx.resources.get(player.id, CORRIDOR_WALLS),
  );
}

function goalY(playerId: number, ctx: RuleContext): number {
  return ctx.players.all()[0]?.id === playerId ? CORRIDOR_SIZE - 1 : 0;
}

function add(
  first: CorridorPosition,
  second: CorridorPosition,
): CorridorPosition {
  return { x: first.x + second.x, y: first.y + second.y };
}

function same(first: CorridorPosition, second: CorridorPosition): boolean {
  return first.x === second.x && first.y === second.y;
}

function sameWall(first: CorridorWall, second: CorridorWall): boolean {
  return same(first, second) && first.orientation === second.orientation;
}

function key(position: CorridorPosition): string {
  return `${position.x},${position.y}`;
}

function uniquePositions(positions: CorridorPosition[]): CorridorPosition[] {
  const seen = new Set<string>();
  return positions.filter((position) => {
    const id = key(position);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
