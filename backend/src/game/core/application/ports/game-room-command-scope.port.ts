export const GAME_ROOM_COMMAND_SCOPE = Symbol('GAME_ROOM_COMMAND_SCOPE');

/** Async call ancestry, isolated from the application scheduling policy. */
export interface GameRoomCommandScope {
  currentRoom(): number | null;
  run<T>(roomId: number, operation: () => Promise<T>): Promise<T>;
}

export class GameRoomNestedCommandError extends Error {
  readonly code = 'GAME_ROOM_NESTED_COMMAND';

  constructor(
    readonly heldRoomId: number,
    readonly requestedRoomId: number,
  ) {
    super(
      `Une commande de room ${heldRoomId} ne peut acquérir la room ${requestedRoomId}`,
    );
    this.name = 'GameRoomNestedCommandError';
  }
}
