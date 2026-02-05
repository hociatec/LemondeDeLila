import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { ZigEtZagMetadata } from '../model/zig-et-zag-state.entity';
import {
  getSelectableCards,
  isCardAllowed,
  playerHasCard,
} from '../round-state.helper';

type ZigEtZagActionType = 'select_card';

function getMeta(state: GameStateEntity): ZigEtZagMetadata {
  return (state.metadata ?? {}) as ZigEtZagMetadata;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') return [];
  if (getMeta(state).winnerId != null) return [];
  const round = getMeta(state).roundState;
  if (!round) return [];

  // Robustness: number ids can round-trip as strings depending on the storage layer.
  const waiting = (round.waitingPlayers ?? [])
    .map((v: any) => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = Number(v.trim());
        return Number.isFinite(n) ? n : null;
      }
      return null;
    })
    .filter((v: any): v is number => typeof v === 'number');

  if (!waiting.includes(playerId)) return [];
  const cards = getSelectableCards(getMeta(state), playerId);
  return cards.map((cardId) => ({
    type: 'select_card',
    payload: { cardId },
  }));
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = String(action?.type ?? '').trim().toLowerCase();
  if (type !== 'select_card') {
    throw new Error(`Action inconnue: ${action?.type}`);
  }
  if (actorId == null) {
    throw new Error('Acteur requis');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new Error('La partie n\'est pas démarrée.');
  }
  const meta = getMeta(state);
  if (meta.winnerId != null) {
    throw new Error('La partie est terminée.');
  }
  const round = meta.roundState;
  if (!round) {
    throw new Error("Ce n'est pas votre tour.");
  }
  const waiting = (round.waitingPlayers ?? [])
    .map((v: any) => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = Number(v.trim());
        return Number.isFinite(n) ? n : null;
      }
      return null;
    })
    .filter((v: any): v is number => typeof v === 'number');
  if (!waiting.includes(actorId)) {
    throw new Error("Ce n'est pas votre tour.");
  }
  const cardId = String((action.payload as any)?.cardId ?? '').trim();
  if (!cardId) {
    throw new Error('Carte manquante.');
  }
  if (!playerHasCard(meta, actorId, cardId)) {
    throw new Error('Vous ne possédez pas cette carte.');
  }
  if (!isCardAllowed(round, actorId, cardId)) {
    throw new Error('Carte non valide pour cette phase.');
  }
  return {
    type: 'select_card',
    payload: { cardId },
  };
}
