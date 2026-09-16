import type { PathWallsPosition } from './program';

type Wall = PathWallsPosition & { orientation: 'h' | 'v' };
type Input = {
  size: number;
  own: PathWallsPosition;
  opponent: PathWallsPosition;
  goal: number;
  opponentGoal: number;
  moves: PathWallsPosition[];
  walls: readonly Wall[];
  candidates: Wall[];
};

function distance(
  size: number,
  start: PathWallsPosition,
  goal: number,
  walls: readonly Wall[],
) {
  const queue = [{ ...start, distance: 0 }];
  const seen = new Set([`${start.x},${start.y}`]);
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (current.y === goal) return current.distance;
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const x = current.x + dx;
      const y = current.y + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const blocked = walls.some((wall) =>
        dy !== 0
          ? wall.orientation === 'h' &&
            wall.y === Math.min(y, current.y) &&
            (wall.x === x || wall.x + 1 === x)
          : wall.orientation === 'v' &&
            wall.x === Math.min(x, current.x) &&
            (wall.y === y || wall.y + 1 === y),
      );
      const key = `${x},${y}`;
      if (blocked || seen.has(key)) continue;
      seen.add(key);
      queue.push({ x, y, distance: current.distance + 1 });
    }
  }
  return Infinity;
}

/** Deterministic one-turn policy: win, shorten our route, or delay the opponent. */
export function choosePathWallsTurn(input: Input): {
  kind: 'move' | 'wall';
  payload: PathWallsPosition | Wall;
} | null {
  const winning = input.moves.find((move) => move.y === input.goal);
  if (winning) return { kind: 'move', payload: winning };
  const ownDistance = distance(input.size, input.own, input.goal, input.walls);
  const opponentDistance = distance(
    input.size,
    input.opponent,
    input.opponentGoal,
    input.walls,
  );
  let best = input.moves[0];
  let bestDistance = Infinity;
  for (const move of input.moves) {
    const remaining = distance(input.size, move, input.goal, input.walls);
    if (remaining < bestDistance) {
      best = move;
      bestDistance = remaining;
    }
  }
  let selectedWall: Wall | undefined;
  // Blocking an imminent win takes priority even for a one-step delay.
  let advantage = opponentDistance === 1 ? 0 : 1;
  for (const wall of input.candidates) {
    const walls = [...input.walls, wall];
    const ownCost =
      distance(input.size, input.own, input.goal, walls) - ownDistance;
    const delay =
      distance(input.size, input.opponent, input.opponentGoal, walls) -
      opponentDistance;
    const gain = delay - ownCost;
    if (gain > advantage && opponentDistance <= ownDistance) {
      advantage = gain;
      selectedWall = wall;
    }
  }
  if (selectedWall) return { kind: 'wall', payload: selectedWall };
  return best ? { kind: 'move', payload: best } : null;
}
