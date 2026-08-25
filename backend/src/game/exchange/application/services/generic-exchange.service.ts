import { Injectable } from '@nestjs/common';

export type ExchangeOffer<TItem = unknown> = { give: TItem; take: TItem };

type ExchangePlayer<TItem> = {
  id: number;
  [key: string]: unknown;
} & Record<string, unknown> & {
    inventory?: TItem[];
  };

@Injectable()
export class GenericExchangeService {
  buildActions<TItem>(
    state: { players: Array<ExchangePlayer<TItem>> },
    playerId: number,
    inventoryKey = 'inventory',
  ): ExchangeOffer<TItem>[] {
    const players = state.players ?? [];
    const self = players.find((p) => p.id === playerId);
    const selfInventory = Array.isArray(self?.[inventoryKey])
      ? (self[inventoryKey] as TItem[])
      : [];
    if (!self || !selfInventory.length) return [];

    const actions: ExchangeOffer<TItem>[] = [];
    players.forEach((p) => {
      if (p.id === playerId) return;
      const targetInv = Array.isArray(p[inventoryKey])
        ? (p[inventoryKey] as TItem[])
        : [];
      if (!targetInv.length) return;
      selfInventory.forEach((give: TItem) => {
        targetInv.forEach((take: TItem) => {
          actions.push({ give, take });
        });
      });
    });
    return actions;
  }
}
