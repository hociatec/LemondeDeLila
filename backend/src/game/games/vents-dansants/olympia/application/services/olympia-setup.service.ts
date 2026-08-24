import type { GameStateEntity } from '../../../../../application/models/game-state.model';

import {
  getRngMeta,
  getSafePlayers,
} from '../../../../../application/helpers/setup-service.helper';
import { RandomService } from '../../../../../application/services/random.service';
import { OLYMPIA_DECKS } from '../../model/olympia-cards';
import type { OlympiaDeckType } from '../../model/olympia-cards';
import type { OlympiaMetadata } from '../../model/olympia-state.model';

const DECK_ORDER: OlympiaDeckType[] = [
  'divinite',
  'heros',
  'creatures',
  'exploits',
  'actions',
  'attaques',
  'evenements',
];

export class OlympiaSetupService {
  constructor(private readonly random: RandomService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const seedMeta = (baseState.metadata ?? {}) as OlympiaMetadata;
    let rngMeta = getRngMeta(seedMeta);

    const decks: Record<OlympiaDeckType, string[]> = {} as Record<
      OlympiaDeckType,
      string[]
    >;
    for (const deckType of DECK_ORDER) {
      const available = [...(OLYMPIA_DECKS[deckType] ?? [])];
      const { values, meta } = this.random.shuffle(rngMeta, available);
      decks[deckType] = values;
      rngMeta = meta;
    }

    const hands: Record<number, string[]> = {};
    const divinity: Record<number, string> = {};
    const prestige: Record<number, number> = {};
    for (const player of players) {
      if (player?.id == null) continue;
      const playerId = player.id;
      prestige[playerId] = 0;
      hands[playerId] = [];
      const divinityCard = this.drawFromDeck(decks, 'divinite');
      divinity[playerId] = divinityCard.cardId ?? '';
      this.drawInitialCards(hands[playerId], decks, 'creatures', 2);
      const actionCard = this.drawFromDeck(decks, 'actions');
      if (actionCard.cardId) {
        hands[playerId].push(actionCard.cardId);
      } else {
        const attackCard = this.drawFromDeck(decks, 'attaques');
        if (attackCard.cardId) {
          hands[playerId].push(attackCard.cardId);
        }
      }
    }

    const metadata: OlympiaMetadata = {
      rng: rngMeta,
      decks,
      discard: [],
      hands,
      divinity,
      prestige,
      statuses: {},
      skipTurn: {},
      winnerId: null,
    };

    return {
      ...baseState,
      status: 'started',
      phase: 'round',
      metadata,
    };
  }

  private drawInitialCards(
    hand: string[],
    decks: Record<OlympiaDeckType, string[]>,
    deckType: OlympiaDeckType,
    amount: number,
  ): void {
    for (let i = 0; i < amount; i += 1) {
      const entry = this.drawFromDeck(decks, deckType);
      if (!entry?.cardId) break;
      hand.push(entry.cardId);
    }
  }

  private drawFromDeck(
    decks: Record<OlympiaDeckType, string[]>,
    deckType: OlympiaDeckType,
  ): { cardId: string | null } {
    const pile = decks[deckType] ?? [];
    if (!pile.length) {
      return { cardId: null };
    }
    const [cardId, ...rest] = pile;
    decks[deckType] = rest;
    return { cardId };
  }
}



