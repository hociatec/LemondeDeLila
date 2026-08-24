import { DeckPoolState } from '../../../application/services/deck-pool.service';
import { PanierExpressDeckPool } from './model/panier-express-state.model';
import { asRecord, toText } from './panier-express-state.helpers';

export function toDrawQueueEntries(
  value: unknown,
): Array<{ playerId: number; standId?: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .map((item) => ({
      playerId: Number(item.playerId),
      standId: toText(item.standId).trim() || undefined,
    }))
    .filter((entry) => Number.isFinite(entry.playerId));
}

export function asStringDeckPool(
  pool: PanierExpressDeckPool,
): DeckPoolState<string> {
  return pool as DeckPoolState<string>;
}



