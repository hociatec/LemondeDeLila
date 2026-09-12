import { gameInput } from '../../actions/game-input-schema';
import { defineConfiguration } from '../../configuration/configuration-kit';
import type { PathWallsPosition, PathWallsProgram } from './program';
import type { PlayerMap } from '../../game-identifiers';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction } from '../../definitions/game-definition-builders';
import { defineChoice } from '../../actions/action-builders';
import { setupPlayingPhases } from '../../kits/phase-kit';
import { pawns } from '../../kits/pawn-kit';
import { gridGame } from '../../patterns/gameplay-pattern-round-economy';
import { sequentialPawnSelection } from '../../recipes/gameplay/pawn-selection.recipes';
import { rejectRule } from '../../../../core/domain/errors/game-domain.errors';

type State = Record<string, never>;
type Context = GameContext<State>;
type Orientation = 'h' | 'v';
type Wall = PathWallsPosition & { orientation: Orientation };
const DIRECTIONS: PathWallsPosition[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function pathWallsRules(source: PathWallsProgram) {
  const program = structuredClone(source);
  const phases = setupPlayingPhases<State>();
  const pawnSelection = sequentialPawnSelection<State>({
    setId: program.pawnSetId,
    choiceId: program.pawnChoiceId,
    complete: ({ ctx }) => {
      phases.transition(ctx, 'playing');
      const first = ctx.players.all()[0];
      if (first) ctx.turn.to(first.id);
    },
  });
  const move = defineAction<State, PathWallsPosition>({
    input: gameInput.object({
      x: gameInput.number({ integer: true, min: 0, max: program.size - 1 }),
      y: gameInput.number({ integer: true, min: 0, max: program.size - 1 }),
    }),
    documentation: 'Déplace le pion sur une case légale, saut compris.',
    available: ({ ctx }) => phases.is(ctx, 'playing'),
    validate: ({ actor, input, ctx }) =>
      legalMoves(actor.id, ctx).some((position) => same(position, input)),
    enumerate: ({ actor, ctx }) => legalMoves(actor.id, ctx),
    execute: ({ actor, input, ctx }) => {
      if (!legalMoves(actor.id, ctx).some((position) => same(position, input)))
        rejectRule('Déplacement PathWalls illégal');
      const from = positions(ctx)[actor.id];
      ctx.grid.clear(program.boardId, from);
      ctx.grid.set(program.boardId, input, actor.id);
      if (input.y === goalY(actor.id, ctx))
        ctx.match.finish({ winners: [actor.id], reason: 'opposite-edge' });
      else ctx.turn.end();
    },
  });
  const placeWall = defineAction<
    State,
    { x: number; y: number; orientation: Orientation }
  >({
    input: gameInput.object({
      x: gameInput.number({ integer: true, min: 0, max: program.size - 2 }),
      y: gameInput.number({ integer: true, min: 0, max: program.size - 2 }),
      orientation: gameInput.enum(['h', 'v'] as const),
    }),
    documentation: 'Place un mur sans chevauchement et sans fermer un chemin.',
    available: ({ actor, ctx }) =>
      phases.is(ctx, 'playing') &&
      ctx.resources.get(actor.id, program.wallsResourceId) > 0,
    validate: ({ actor, input, ctx }) =>
      legalWalls(actor.id, ctx).some((wall) => sameWall(wall, input)),
    enumerate: ({ actor, ctx }) => legalWalls(actor.id, ctx),
    execute: ({ actor, input, ctx }) => {
      if (!legalWalls(actor.id, ctx).some((wall) => sameWall(wall, input)))
        rejectRule('Placement de mur PathWalls illégal');
      ctx.grid.appendOverlay(program.boardId, program.wallsOverlayId, input);
      ctx.resources.remove(actor.id, program.wallsResourceId, 1);
      ctx.turn.end();
    },
  });

  function start(wallsPerPlayer: number, ctx: Context): void {
    for (const player of ctx.players.all())
      ctx.resources.set(player.id, program.wallsResourceId, wallsPerPlayer);
    pawnSelection.requestAll(
      ctx.players.all().map((player) => player.id),
      ctx,
    );
  }

  function positions(ctx: Context): PlayerMap<PathWallsPosition> {
    return Object.fromEntries(
      ctx.grid
        .entries<number>(program.boardId)
        .map(({ position, value }) => [value, position]),
    );
  }

  function walls(ctx: Context): readonly Wall[] {
    return ctx.grid.overlays<Wall>(program.boardId, program.wallsOverlayId);
  }

  function legalMoves(actorId: number, ctx: Context): PathWallsPosition[] {
    const byPlayer = positions(ctx);
    const from = byPlayer[actorId];
    const opponent = ctx.players.all().find((player) => player.id !== actorId);
    const opponentPosition = opponent ? byPlayer[opponent.id] : null;
    const results: PathWallsPosition[] = [];
    for (const direction of DIRECTIONS) {
      const step = add(from, direction);
      if (!inside(step) || edgeBlocked(walls(ctx), from, step)) continue;
      if (opponentPosition && same(step, opponentPosition)) {
        const jump = add(step, direction);
        if (inside(jump) && !edgeBlocked(walls(ctx), step, jump))
          results.push(jump);
        else {
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
            if (inside(diagonal) && !edgeBlocked(walls(ctx), step, diagonal))
              results.push(diagonal);
          }
        }
      } else if (
        !Object.values(byPlayer).some((position) => same(position, step))
      )
        results.push(step);
    }
    return unique(results);
  }

  function legalWalls(actorId: number, ctx: Context): Wall[] {
    if (ctx.resources.get(actorId, program.wallsResourceId) <= 0) return [];
    const result: Wall[] = [];
    for (const orientation of ['h', 'v'] as const)
      for (let y = 0; y < program.size - 1; y++)
        for (let x = 0; x < program.size - 1; x++) {
          const wall = { x, y, orientation };
          const existing = walls(ctx);
          if (overlaps(existing, wall)) continue;
          const candidate = [...existing, wall];
          if (
            ctx.players
              .all()
              .every((player) =>
                hasPath(
                  candidate,
                  positions(ctx)[player.id],
                  goalY(player.id, ctx),
                ),
              )
          )
            result.push(wall);
        }
    return result;
  }

  function hasPath(
    allWalls: readonly Wall[],
    start: PathWallsPosition,
    goal: number,
  ) {
    const queue = [start];
    const seen = new Set([key(start)]);
    while (queue.length) {
      const current = queue.shift()!;
      if (current.y === goal) return true;
      for (const direction of DIRECTIONS) {
        const next = add(current, direction);
        if (!inside(next) || edgeBlocked(allWalls, current, next)) continue;
        if (seen.has(key(next))) continue;
        seen.add(key(next));
        queue.push(next);
      }
    }
    return false;
  }

  function inside(position: PathWallsPosition) {
    return (
      position.x >= 0 &&
      position.y >= 0 &&
      position.x < program.size &&
      position.y < program.size
    );
  }

  function edgeBlocked(
    allWalls: readonly Wall[],
    from: PathWallsPosition,
    to: PathWallsPosition,
  ) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return true;
    if (dy !== 0) {
      const y = Math.min(from.y, to.y);
      return allWalls.some(
        (wall) =>
          wall.orientation === 'h' &&
          wall.y === y &&
          (wall.x === from.x || wall.x + 1 === from.x),
      );
    }
    const x = Math.min(from.x, to.x);
    return allWalls.some(
      (wall) =>
        wall.orientation === 'v' &&
        wall.x === x &&
        (wall.y === from.y || wall.y + 1 === from.y),
    );
  }

  function goalY(playerId: number, ctx: Context) {
    return ctx.players.all()[0]?.id === playerId ? program.size - 1 : 0;
  }

  return {
    move,
    placeWall,
    patterns: [
      gridGame({
        boardId: program.boardId,
        width: program.size,
        height: program.size,
      }),
    ],
    components: [pawns.set({ id: program.pawnSetId, pawns: program.pawns })],
    initialization: {
      resources: { [program.wallsResourceId]: program.defaultWallsPerPlayer },
      startRound: false,
      gridPlacements: [
        {
          boardId: program.boardId,
          positions: program.startPositions,
          emptyOverlays: [program.wallsOverlayId],
        },
      ],
    },
    config: defineConfiguration<State, { wallsPerPlayer: number }>({
      input: gameInput.object({
        wallsPerPlayer: gameInput.number({ integer: true, min: 0, max: 20 }),
      }),
      defaults: { wallsPerPlayer: program.defaultWallsPerPlayer },
      phase: phases.initialPhase,
      permission: 'owner',
      ui: {
        title: 'Configuration du PathWalls',
        submitLabel: 'Choisir les pions',
      },
      onConfigured: ({ config, ctx }) => start(config.wallsPerPlayer, ctx),
    }),
    choices: {
      [program.pawnChoiceId]: defineChoice<State, string>({
        input: gameInput.string({ min: 1, max: 128 }),
        resolve: ({ actor, value, ctx }) =>
          pawnSelection.resolve(actor.id, value, ctx),
      }),
    },
    firstMove: (actorId: number, ctx: Context) => legalMoves(actorId, ctx)[0],
  };
}
function add(a: PathWallsPosition, b: PathWallsPosition): PathWallsPosition {
  return { x: a.x + b.x, y: a.y + b.y };
}
function same(a: PathWallsPosition, b: PathWallsPosition) {
  return a.x === b.x && a.y === b.y;
}
function sameWall(a: Wall, b: Wall) {
  return same(a, b) && a.orientation === b.orientation;
}
function key(position: PathWallsPosition) {
  return `${position.x},${position.y}`;
}
function unique(items: PathWallsPosition[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(key(item))) return false;
    seen.add(key(item));
    return true;
  });
}
function overlaps(allWalls: readonly Wall[], wall: Wall) {
  return allWalls.some((current) => {
    if (
      current.x === wall.x &&
      current.y === wall.y &&
      current.orientation !== wall.orientation
    )
      return true;
    if (current.orientation !== wall.orientation) return false;
    return wall.orientation === 'h'
      ? current.y === wall.y && Math.abs(current.x - wall.x) <= 1
      : current.x === wall.x && Math.abs(current.y - wall.y) <= 1;
  });
}
