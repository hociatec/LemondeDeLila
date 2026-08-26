import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import { CORRIDOR_PAWNS } from './content';
import type {
  CorridorOrientation,
  CorridorPosition,
  CorridorState,
  CorridorWall,
} from './state';

type RuleContext = GameRuleContext<CorridorState>;
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
  available: ({ state }) => state.setupComplete,
  availableInputs: ({ state, actor, ctx }) => legalMoves(state, actor.id, ctx),
  execute: ({ state, actor, input, ctx }) => {
    if (
      !legalMoves(state, actor.id, ctx).some((position) =>
        same(position, input),
      )
    ) {
      throw new Error('Déplacement Corridor illégal');
    }
    state.positions[actor.id] = { ...input };
    if (input.y === state.goalYByPlayerId[actor.id]) state.winnerId = actor.id;
    if (state.winnerId == null) ctx.turn.end();
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
  available: ({ state, actor }) =>
    state.setupComplete && state.wallsRemaining[actor.id] > 0,
  availableInputs: ({ state, actor, ctx }) => legalWalls(state, actor.id, ctx),
  execute: ({ state, actor, input, ctx }) => {
    if (
      !legalWalls(state, actor.id, ctx).some((wall) => sameWall(wall, input))
    ) {
      throw new Error('Placement de mur Corridor illégal');
    }
    state.walls.push({ ...input });
    state.wallsRemaining[actor.id] -= 1;
    ctx.turn.end();
  },
});

export const CORRIDOR_ACTIONS = {
  corridor_move: move,
  corridor_place_wall: placeWall,
};

export function resolveConfig(
  state: CorridorState,
  wallsPerPlayer: number,
  ctx: RuleContext,
): void {
  if (
    !Number.isInteger(wallsPerPlayer) ||
    wallsPerPlayer < 0 ||
    wallsPerPlayer > 20
  ) {
    throw new Error('Nombre de murs Corridor invalide');
  }
  state.wallsPerPlayer = wallsPerPlayer;
  state.wallsRemaining = Object.fromEntries(
    ctx.players.all().map((player) => [player.id, wallsPerPlayer]),
  );
  const first = ctx.players.all()[0];
  if (first) {
    ctx.turn.to(first.id);
    requestPawn(state, first.id, ctx);
  }
}

export function resolvePawn(
  state: CorridorState,
  actorId: number,
  pawnId: string,
  ctx: RuleContext,
): void {
  if (!CORRIDOR_PAWNS.some((pawn) => pawn.id === pawnId)) {
    throw new Error('Pion Corridor invalide');
  }
  if (Object.values(state.pawnByPlayerId).includes(pawnId)) {
    throw new Error('Ce pion est déjà choisi');
  }
  state.pawnByPlayerId[actorId] = pawnId;
  const next = ctx.players
    .all()
    .find((player) => state.pawnByPlayerId[player.id] == null);
  if (next) {
    ctx.turn.to(next.id);
    requestPawn(state, next.id, ctx);
  } else {
    state.setupComplete = true;
    ctx.transitionTo('playing');
    ctx.turn.to(ctx.players.all()[0].id);
  }
}

export function requestConfig(state: CorridorState, ctx: RuleContext): void {
  ctx.choice.one({
    id: 'corridor.config',
    player: state.ownerPlayerId,
    options: Array.from({ length: 21 }, (_entry, value) => value),
    label: (value) => `${value} mur(s) par joueur`,
  });
}

function requestPawn(
  state: CorridorState,
  playerId: number,
  ctx: RuleContext,
): void {
  const used = new Set(Object.values(state.pawnByPlayerId));
  const options = CORRIDOR_PAWNS.filter((pawn) => !used.has(pawn.id));
  ctx.choice.one({
    id: 'corridor.pawn',
    player: playerId,
    options: options.map((pawn) => pawn.id),
    label: (pawnId) =>
      options.find((pawn) => pawn.id === pawnId)?.label ?? pawnId,
  });
}

export function legalMoves(
  state: CorridorState,
  actorId: number,
  ctx: RuleContext,
): CorridorPosition[] {
  const from = state.positions[actorId];
  const opponent = ctx.players.all().find((player) => player.id !== actorId);
  const opponentPosition = opponent ? state.positions[opponent.id] : null;
  const results: CorridorPosition[] = [];
  for (const direction of DIRECTIONS) {
    const step = add(from, direction);
    if (!inside(state, step) || edgeBlocked(state, from, step)) continue;
    if (opponentPosition && same(step, opponentPosition)) {
      const jump = add(step, direction);
      if (inside(state, jump) && !edgeBlocked(state, step, jump)) {
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
          if (inside(state, diagonal) && !edgeBlocked(state, step, diagonal)) {
            results.push(diagonal);
          }
        }
      }
    } else if (
      !Object.values(state.positions).some((position) => same(position, step))
    ) {
      results.push(step);
    }
  }
  return uniquePositions(results);
}

export function legalWalls(
  state: CorridorState,
  actorId: number,
  ctx: RuleContext,
): CorridorWall[] {
  if (state.wallsRemaining[actorId] <= 0) return [];
  const walls: CorridorWall[] = [];
  for (const orientation of ['h', 'v'] as const) {
    for (let y = 0; y < state.size - 1; y += 1) {
      for (let x = 0; x < state.size - 1; x += 1) {
        const wall = { x, y, orientation };
        if (overlaps(state, wall)) continue;
        const candidate = { ...state, walls: [...state.walls, wall] };
        if (
          ctx.players
            .all()
            .every((player) =>
              hasPath(
                candidate,
                candidate.positions[player.id],
                candidate.goalYByPlayerId[player.id],
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
  state: CorridorState,
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
      if (!inside(state, next) || edgeBlocked(state, current, next)) continue;
      const id = key(next);
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(next);
    }
  }
  return false;
}

function edgeBlocked(
  state: CorridorState,
  from: CorridorPosition,
  to: CorridorPosition,
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return true;
  if (dy !== 0) {
    const y = Math.min(from.y, to.y);
    return state.walls.some(
      (wall) =>
        wall.orientation === 'h' &&
        wall.y === y &&
        (wall.x === from.x || wall.x + 1 === from.x),
    );
  }
  const x = Math.min(from.x, to.x);
  return state.walls.some(
    (wall) =>
      wall.orientation === 'v' &&
      wall.x === x &&
      (wall.y === from.y || wall.y + 1 === from.y),
  );
}

function overlaps(state: CorridorState, wall: CorridorWall): boolean {
  return state.walls.some((existing) => {
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

function inside(state: CorridorState, position: CorridorPosition): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < state.size &&
    position.y < state.size
  );
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
