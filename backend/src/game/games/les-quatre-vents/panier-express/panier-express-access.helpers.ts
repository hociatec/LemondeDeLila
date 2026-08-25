import { GameStateEntity } from '../../../core/application/models/game-state.model';
import { GameSingleActionDto } from '../../../core/application/models/game-action.model';
import {
  PanierExpressMetadata,
  PanierExpressPlayer,
} from './model/panier-express-state.model';
import { asRecord, toText } from './panier-express-state.helpers';

export function getPanierExpressMetadataRecord(
  state: GameStateEntity,
): Record<string, unknown> {
  return asRecord(state.metadata);
}

export function getPanierExpressPawnText(player: unknown): string {
  const record = asRecord(player);
  return toText(record.pawn).trim();
}

export function getPanierExpressPlayers(
  state: GameStateEntity,
): PanierExpressPlayer[] {
  return (state.players ?? []) as PanierExpressPlayer[];
}

export function getPanierExpressActorIdFromAction(
  action: GameSingleActionDto,
): number | null {
  const meta = asRecord(action.meta);
  return typeof meta.actorId === 'number' ? meta.actorId : null;
}

export function getPanierExpressPendingRecord(
  state: GameStateEntity,
): Record<string, unknown> | null {
  if (state.pending == null) return null;
  return asRecord(state.pending);
}

export function getPanierExpressMetadata(
  state: GameStateEntity,
  buildMetadata: (state: GameStateEntity) => PanierExpressMetadata,
): PanierExpressMetadata {
  return (state.metadata ?? buildMetadata(state)) as PanierExpressMetadata;
}




