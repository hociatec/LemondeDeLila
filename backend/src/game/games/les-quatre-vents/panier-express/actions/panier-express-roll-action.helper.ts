import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../models/game-action.model';
import type { PanierExpressMetadata } from '../model/panier-express-state.model';

export function applyPanierExpressRollAction(input: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  getMetadataRecord: (state: GameStateEntity) => Record<string, unknown>;
  rollDice: (
    metadata: PanierExpressMetadata,
    sides: number,
  ) => { roll: number; meta: PanierExpressMetadata };
  cloneState: (state: GameStateEntity) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  appendActionLog: (
    state: GameStateEntity,
    playerId: number,
    action: string,
    details?: Record<string, unknown>,
  ) => GameStateEntity;
  playerName: (state: GameStateEntity, playerId: number) => string;
  movePlayer: (
    state: GameStateEntity,
    playerId: number,
    roll: number,
  ) => GameStateEntity;
  resolveTile: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
  getAvailableActions: (
    state: GameStateEntity,
    playerId: number,
  ) => Array<{ type?: string | null }>;
  getTurnStatus: (
    state: GameStateEntity,
    playerId: number,
    key: string,
  ) => number;
  clearTurnStatus: (
    state: GameStateEntity,
    playerId: number,
    key: string,
  ) => GameStateEntity;
  advanceTurn: (state: GameStateEntity) => GameStateEntity;
  logEvent: (event: string, payload: Record<string, unknown>) => void;
}): GameStateEntity {
  const currentId = input.state.turn?.currentPlayerId ?? null;
  if (currentId == null) return input.state;

  const meta = input.getMetadata(input.state);
  const rng = input.rollDice(meta, 6);
  const roll = rng.roll;
  const direction = input.state.turn?.direction === -1 ? -1 : 1;
  const signedRoll = roll * direction;

  input.logEvent('panier.roll', {
    roomId: input.getMetadataRecord(input.state).roomId ?? null,
    gameType: input.getMetadataRecord(input.state).gameType ?? null,
    userId: input.action?.meta?.actorId ?? currentId,
    type: input.action?.type ?? 'roll',
    currentId,
    turnIndex: input.state.turnIndex,
    roll,
    status: input.state.status,
  });

  let next = input.cloneState(input.state);
  next.metadata = rng.meta;
  next.lastRoll = roll;
  next = input.appendLog(
    next,
    `${input.playerName(input.state, currentId)} lance le dÃƒÂ© : "${roll}"`,
  );
  next = input.appendActionLog(next, currentId, 'roll', { roll });

  next = input.movePlayer(next, currentId, signedRoll);
  next = input.resolveTile(next, currentId);

  const metaAfter = input.getMetadata(next);
  const postActions = input.getAvailableActions(next, currentId);
  const hasBlockingQuiz = Boolean(metaAfter.quiz.pending[currentId]);
  const hasBlockingPending = Boolean(next.pending?.blocking);
  const hasBlockingExchange = postActions.some((action) =>
    ['exchange_choose_target', 'exchange_choose_give'].includes(
      (action.type || '').toLowerCase(),
    ),
  );
  const keepTurn = input.getTurnStatus(next, currentId, 'keepTurn');
  if (keepTurn > 0) {
    next = input.clearTurnStatus(next, currentId, 'keepTurn');
    return input.appendLog(
      next,
      `[Panier Express] ${input.playerName(input.state, currentId)} rejoue (bonus de tour).`,
    );
  }

  if (!hasBlockingQuiz && !hasBlockingExchange && !hasBlockingPending) {
    const skipTurn = input.getTurnStatus(next, currentId, 'skipTurn');
    if (roll === 6 && !(skipTurn > 0)) {
      return input.appendLog(
        next,
        `[Panier Express] ${input.playerName(input.state, currentId)} rejoue (sur un 6).`,
      );
    }
    next = input.advanceTurn(next);
  }

  return next;
}





