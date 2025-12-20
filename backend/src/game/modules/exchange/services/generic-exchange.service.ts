import { Injectable } from '@nestjs/common';

export type ExchangeOffer<TItem = any> = { give: TItem; take: TItem };

@Injectable()
export class GenericExchangeService {
  buildActions<TItem>(
    state: { players: any[] },
    playerId: number,
    inventoryKey = 'inventory',
  ): ExchangeOffer<TItem>[] {
    const players = state.players ?? [];
    const self = players.find((p) => p.id === playerId);
    if (!self || !self[inventoryKey]?.length) return [];

    const actions: ExchangeOffer<TItem>[] = [];
    players.forEach((p) => {
      if (p.id === playerId) return;
      const targetInv = p[inventoryKey] ?? [];
      if (!targetInv.length) return;
      self[inventoryKey].forEach((give: TItem) => {
        targetInv.forEach((take: TItem) => {
          actions.push({ give, take });
        });
      });
    });
    return actions;
  }
}
