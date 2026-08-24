import type {
  GameStateEntity,
  PendingState,
} from '../../../../application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../application/helpers/player-name.helper';
import type { SacMetadata, SacTile } from '../model/sac-a-malices.types';

function extractEuroAmount(text: string): number {
  const match = text.match(/(\d+)\s*[€e]/i) ?? text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function applySacAMalicesLanding(input: {
  state: GameStateEntity;
  playerId: number;
  getMeta: (state: GameStateEntity) => SacMetadata;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  pawnLabel: (state: GameStateEntity, playerId: number) => string;
  getRules: (
    meta: SacMetadata,
  ) => NonNullable<SacMetadata['rules']>;
  setPot: (state: GameStateEntity, value: number) => GameStateEntity;
  addMoney: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    options: { toPot: boolean },
  ) => GameStateEntity;
  sendToJail: (state: GameStateEntity, playerId: number) => GameStateEntity;
  drawAndApply: (
    state: GameStateEntity,
    playerId: number,
    deckId: 'chance' | 'community',
  ) => GameStateEntity;
  getPurchasePrice: (meta: SacMetadata, tile: SacTile) => number;
  getBuilding: (
    meta: SacMetadata,
    tileIndex: number,
  ) => { houses: number; hotel: boolean; mortgaged: boolean };
  getRent: (
    meta: SacMetadata,
    tile: SacTile,
    tileIndex: number,
    owner: number,
    lastRoll: number,
  ) => number;
}): GameStateEntity {
  let next = input.state;
  const meta = input.getMeta(next);
  const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
  const pos = meta.positions?.[input.playerId] ?? 0;
  const tile: SacTile | undefined = tiles[pos];
  if (!tile) return next;

  next = input.appendLog(
    next,
    `${resolvePlayerNameFromState(next, input.playerId)} place ${input.pawnLabel(next, input.playerId)} en case ${pos + 1} (${tile.title}).`,
  );
  if (tile.description && String(tile.description).trim()) {
    next = input.appendLog(next, String(tile.description).trim());
  }

  if (tile.type === 'go_to_jail') {
    next = input.appendLog(next, 'Direction la prison.');
    return input.sendToJail(next, input.playerId);
  }

  if (tile.type === 'free') {
    const rules = input.getRules(input.getMeta(next));
    if (!rules.potEnabled) {
      return input.appendLog(next, 'Parking : rien ne se passe.');
    }
    const pot = input.getMeta(next).pot ?? 0;
    if (pot > 0) {
      next = input.appendLog(next, `Parc Gratuit : vous récupérez ${pot} €.`);
      next = input.setPot(next, 0);
      next = input.addMoney(next, input.playerId, pot, { toPot: false });
    } else {
      next = input.appendLog(next, 'Parc Gratuit : pot vide.');
    }
    return next;
  }

  if (tile.type === 'tax') {
    const amount = extractEuroAmount(`${tile.title} ${tile.description ?? ''}`);
    if (amount > 0) {
      next = input.appendLog(next, `Taxe : ${amount} €.`);
      next = input.addMoney(next, input.playerId, -amount, { toPot: true });
    }
    return next;
  }

  if (tile.type === 'chance') {
    next = input.appendLog(next, 'Chance : pioche.');
    return input.drawAndApply(next, input.playerId, 'chance');
  }

  if (tile.type === 'community') {
    next = input.appendLog(next, 'Caisse de Communauté : pioche.');
    return input.drawAndApply(next, input.playerId, 'community');
  }

  if (
    tile.type === 'property' ||
    tile.type === 'station' ||
    tile.type === 'utility'
  ) {
    const owner = meta.ownership?.[pos];
    if (owner == null) {
      const price = input.getPurchasePrice(meta, tile);
      const pending: PendingState = {
        type: 'buy',
        playerId: input.playerId,
        blocking: true,
        label: `Acheter "${tile.title}" (${price > 0 ? price + ' €' : 'prix inconnu'}) ?`,
        choices: ['Acheter', 'Passer'],
        data: { tileIndex: pos },
      };
      return { ...next, pending };
    }
    if (owner === input.playerId) return next;
    const rules = input.getRules(meta);
    if (rules.rentBlockedInJail && (meta.statuses?.inJail?.[owner] ?? 0) > 0) {
      return input.appendLog(next, 'Le propriétaire est en prison : pas de loyer.');
    }
    const building = input.getBuilding(meta, pos);
    if (building.mortgaged) {
      return input.appendLog(next, 'Propriété hypothéquée : pas de loyer.');
    }
    const rent = input.getRent(meta, tile, pos, owner, input.state.lastRoll ?? 0);
    if (rent > 0) {
      next = input.appendLog(
        next,
        `Loyer : ${rent} € à ${resolvePlayerNameFromState(next, owner)}.`,
      );
      next = input.addMoney(next, input.playerId, -rent, { toPot: false });
      next = input.addMoney(next, owner, rent, { toPot: false });
    }
    return next;
  }

  return next;
}




