import {
  GameConfigurationError,
  GameNotFoundError,
  GameRuleViolationError,
  GameStateViolationError,
} from '../../domain/errors/game-domain.errors';

export type GridDefinition = {
  readonly component: 'grid.board';
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly diagonals?: boolean;
};

export type GridPosition = { x: number; y: number };
export type GridKitState = {
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
      throw new GameConfigurationError('Dimensions de grille invalides');
    }
    return Object.freeze({ ...options, component: 'grid.board' });
  },
};

export class GameGridController {
  constructor(
    private readonly state: GridKitState,
    definitions: readonly GridDefinition[] = [],
  ) {
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition);
    }
    const legacy = this.state as GridKitState & {
      boards?: Record<string, Omit<GridDefinition, 'component'>>;
    };
    for (const definition of Object.values(legacy.boards ?? {})) {
      this.definitions.set(definition.id, {
        ...definition,
        component: 'grid.board',
      });
    }
    delete legacy.boards;
  }

  private readonly definitions = new Map<string, GridDefinition>();

  create(definition: GridDefinition): void {
    this.definitions.set(definition.id, definition);
    this.state.cells[definition.id] ??= {};
  }

  reset(boardId: string): void {
    this.definitions.delete(boardId);
    delete this.state.cells[boardId];
  }

  assertValid(): void {
    for (const [boardId, cells] of Object.entries(this.state.cells)) {
      const board = this.definitions.get(boardId);
      if (!board) {
        throw new GameStateViolationError('Grille absente', { boardId });
      }
      for (const key of Object.keys(cells)) {
        const [x, y] = key.split(',').map(Number);
        if (
          !Number.isInteger(x) ||
          !Number.isInteger(y) ||
          x < 0 ||
          y < 0 ||
          x >= board.width ||
          y >= board.height
        ) {
          throw new GameStateViolationError('Case de grille invalide', {
            boardId,
            key,
          });
        }
      }
    }
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
    if (!this.inside(boardId, position)) {
      throw new GameRuleViolationError(
        'GRID_POSITION_OUT_OF_BOUNDS',
        { boardId, position },
        'Case hors grille',
      );
    }
    (this.state.cells[boardId] ??= {})[cellKey(position)] = value;
  }

  clear(boardId: string, position: GridPosition): void {
    this.requireBoard(boardId);
    delete this.state.cells[boardId]?.[cellKey(position)];
  }

  entries<TValue>(
    boardId: string,
  ): Array<{ position: GridPosition; value: TValue }> {
    this.requireBoard(boardId);
    return Object.entries(this.state.cells[boardId] ?? {}).map(
      ([key, value]) => {
        const [x, y] = key.split(',').map(Number);
        return { position: { x, y }, value: value as TValue };
      },
    );
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
    const board = this.definitions.get(boardId);
    if (!board) throw new GameNotFoundError(`Grille inconnue: ${boardId}`);
    return board;
  }
}

export function createGridKitState(): GridKitState {
  return { cells: {} };
}

function cellKey(position: GridPosition): string {
  return `${position.x},${position.y}`;
}
