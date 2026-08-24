import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../models/game-action.model';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

export function applyPanierExpressDrawAction(input: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  applyEvent: (state: GameStateEntity, playerId: number) => GameStateEntity;
  advanceAfterDraw: (state: GameStateEntity) => GameStateEntity;
  handleLuckyDraw: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
  handleGenerousProducerDraw: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
  handleSeasonChangeDraw: (
    state: GameStateEntity,
    playerId: number,
    data: Record<string, unknown>,
  ) => GameStateEntity;
  continueQueuedDraw: (args: {
    state: GameStateEntity;
    queue: unknown;
    cursor: number;
    label: string;
  }) => GameStateEntity;
  toQueueEntries: (value: unknown) => unknown;
}): GameStateEntity {
  const pending = input.state.pending;
  if (!pending || pending.type !== 'draw') return input.state;

  const actionMeta = asRecord(input.action.meta);
  const actorId =
    typeof actionMeta.actorId === 'number'
      ? actionMeta.actorId
      : Number(pending.playerId);
  const pendingPlayerId = Number(pending.playerId);
  if (
    Number.isFinite(pendingPlayerId) &&
    Number.isFinite(actorId) &&
    pendingPlayerId !== actorId
  ) {
    return input.appendLog(
      input.state,
      `[Panier Express] Pioche refusÃƒÂ©e : ce n'est pas le bon joueur.`,
    );
  }

  const data = asRecord(pending.data);
  const kind = toText(data.kind).trim() || 'queue';
  const next: GameStateEntity = { ...input.state, pending: null };

  if (kind === 'event.card') {
    return input.advanceAfterDraw(input.applyEvent(next, pendingPlayerId));
  }

  if (kind === 'event.tirage_chanceux') {
    return input.handleLuckyDraw(next, pendingPlayerId);
  }

  if (kind === 'event.producteur_genereux') {
    return input.handleGenerousProducerDraw(next, pendingPlayerId);
  }

  if (kind === 'event.changement_de_saison') {
    return input.handleSeasonChangeDraw(next, pendingPlayerId, data);
  }

  const queue = input.toQueueEntries(data.queue);
  const cursor = Number(data.cursor ?? 0);
  return input.continueQueuedDraw({
    state: next,
    queue,
    cursor,
    label: pending.label ?? 'Piocher une carte (Espace).',
  });
}




