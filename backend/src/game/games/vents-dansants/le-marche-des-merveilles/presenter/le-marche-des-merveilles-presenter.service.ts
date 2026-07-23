import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto, GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { formatPresenterActions } from '../../../../presenters/actions-presenter.helper';
import {
  GOOD_LABELS,
  WONDER_GOODS,
  copyInventory,
  inventoryValue,
} from '../model/le-marche-des-merveilles-market';
import type {
  LeMarcheDesMerveillesMetadata,
  WonderGood,
} from '../model/le-marche-des-merveilles-state.entity';
import * as Rulebook from '../rulebook/rulebook';

@Injectable()
export class LeMarcheDesMerveillesPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as LeMarcheDesMerveillesMetadata;
    const actions = Rulebook.getAvailableActions(state, userId);
    const playerLines = (state.players ?? []).map((player) => {
      const playerId = Number(player?.id ?? 0);
      const coins = meta.coins?.[playerId] ?? 0;
      const inventory = copyInventory(meta.inventories?.[playerId]);
      const total = coins + inventoryValue(inventory, meta.prices);
      const protectedText = meta.protectedPlayers?.[playerId]
        ? ', etal protege'
        : '';
      return `${player.username}: ${coins} pieces, valeur ${total}${protectedText}`;
    });
    const marketLines = WONDER_GOODS.map(
      (good) => `${GOOD_LABELS[good]}: ${meta.prices?.[good] ?? 0} pieces`,
    );
    const myInventory = copyInventory(meta.inventories?.[userId]);

    return {
      ...state,
      catalog: {
        phases: ['market'],
        victory: null,
      },
      actions: formatPresenterActions(actions, (action) =>
        this.labelAction(action),
      ),
      extras: {
        market: marketLines,
        prices: meta.prices,
        coins: meta.coins,
        inventories: meta.inventories,
        myInventory,
        round: meta.round,
        maxRounds: meta.maxRounds,
        lastMarketEvent: meta.lastMarketEvent,
        ui: {
          panels: [
            {
              title: 'Marche',
              lines: marketLines,
            },
            {
              title: 'Marchands',
              lines: playerLines,
            },
            {
              title: 'Mon etal',
              lines: WONDER_GOODS.map(
                (good) => `${GOOD_LABELS[good]}: ${myInventory[good]}`,
              ),
            },
          ],
        },
      },
      pending: state.pending ?? null,
    } as GameStateWithActions;
  }

  private labelAction(action: GameSingleActionDto): string {
    const payload = (action.payload ?? {}) as {
      good?: WonderGood;
      direction?: string;
      targetPlayerId?: number;
    };
    const goodLabel = payload.good ? GOOD_LABELS[payload.good] : '';
    switch (action.type) {
      case 'buy':
        return `Acheter ${goodLabel}`;
      case 'sell':
        return `Vendre ${goodLabel}`;
      case 'rumor':
        return payload.direction === 'down'
          ? `Rumeur: faire baisser ${goodLabel}`
          : `Rumeur: faire monter ${goodLabel}`;
      case 'protect':
        return 'Proteger mon etal';
      case 'steal_deal':
        return `Voler une bonne affaire: ${goodLabel}`;
      case 'pass':
        return 'Observer le marche';
      default:
        return action.type;
    }
  }
}
