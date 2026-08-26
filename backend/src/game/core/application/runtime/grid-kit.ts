export type GridDefinition = {
  readonly component: 'grid.board';
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly diagonals?: boolean;
};

export type GridPosition = { x: number; y: number };
export type GridKitState = {
  boards: Record<string, Omit<GridDefinition, 'component'>>;
  cells: Record<string, Record<string, unknown>>;
};

export const grid = {
  board(options: Omit<GridDefinition, 'component'>): GridDefinition {
    if (
      !Number.isInteger(options.width) ||
      !Number.isInteger(options.height) ||
      options.width < 1 ||
      options.height < 1
    ) {
      throw new Error('Dimensions de grille invalides');
    }
    return Object.freeze({ ...options, component: 'grid.board' });
  },
};

export class GameGridController {
  constructor(private readonly state: GridKitState) {}

  create(definition: GridDefinition): void {
    this.state.boards[definition.id] = { ...definition };
    this.state.cells[definition.id] ??= {};
  }

  inside(boardId: string, position: GridPosition): boolean {
    const board = this.requireBoard(boardId);
    return (
      Number.isInteger(position.x) &&
      Number.isInteger(position.y) &&
      position.x >= 0 &&
      position.y >= 0 &&
      position.x < board.width &&
      position.y < board.height
    );
  }

  get<TValue>(boardId: string, position: GridPosition): TValue | null {
    if (!this.inside(boardId, position)) return null;
    return (
      (this.state.cells[boardId]?.[cellKey(position)] as TValue | undefined) ??
      null
    );
  }

  set<TValue>(boardId: string, position: GridPosition, value: TValue): void {
    if (!this.inside(boardId, position)) throw new Error('Case hors grille');
    (this.state.cells[boardId] ??= {})[cellKey(position)] = value;
  }

  neighbors(boardId: string, position: GridPosition): GridPosition[] {
    const board = this.requireBoard(boardId);
    const offsets = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      ...(board.diagonals
        ? [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ]
        : []),
    ];
    return offsets
      .map(([x, y]) => ({ x: position.x + x, y: position.y + y }))
      .filter((candidate) => this.inside(boardId, candidate));
  }

  private requireBoard(boardId: string): Omit<GridDefinition, 'component'> {
    const board = this.state.boards[boardId];
    if (!board) throw new Error(`Grille inconnue: ${boardId}`);
    return board;
  }
}

export function createGridKitState(): GridKitState {
  return { boards: {}, cells: {} };
}

function cellKey(position: GridPosition): string {
  return `${position.x},${position.y}`;
}
