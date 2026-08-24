import type {
  GameStateEntity,
  PlayerStateEntity,
} from '../../../../application/models/game-state.model';

type ResolvePendingPawnChoiceResult = {
  playerId: number;
  chosen: Record<string, unknown> | null;
};

export function applyPanierExpressChoosePawnAction(input: {
  state: GameStateEntity;
  resolvePendingPawnChoiceAction: () => ResolvePendingPawnChoiceResult | null;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  getPlayers: (state: GameStateEntity) => PlayerStateEntity[];
  playerName: (state: GameStateEntity, playerId: number) => string;
  ensureStarted: (state: GameStateEntity) => GameStateEntity;
  queuePawnSelection: (state: GameStateEntity) => GameStateEntity;
}): GameStateEntity {
  const resolved = input.resolvePendingPawnChoiceAction();
  if (!resolved) {
    return input.appendLog(
      input.state,
      `[Panier Express] Choix de pion invalide.`,
    );
  }

  const chosen = String(resolved.chosen?.id ?? '').trim();
  if (!chosen) {
    return { ...input.state, pending: null };
  }

  let next: GameStateEntity = {
    ...input.state,
    pending: null,
    players: input
      .getPlayers(input.state)
      .map((player) =>
        Number(player.id) === resolved.playerId
          ? { ...player, pawn: chosen }
          : player,
      ),
  };
  next = input.appendLog(
    next,
    `${input.playerName(input.state, resolved.playerId)} a choisi le pion: ${chosen}.`,
  );

  const statusNow = String(input.state.status ?? '').toLowerCase();
  if (statusNow === 'starting') {
    return input.ensureStarted({ ...next, status: 'starting' });
  }

  return input.queuePawnSelection({
    ...next,
    status: input.state.status ?? 'open',
  });
}
