import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';

import {
  getRngMeta,
  getSafePlayers,
} from '../../../../setup/setup-service.helper';
import { RandomService } from '../../../../modules/random/services/random.service';
import {
  DAME_NATURE_CARD_BY_ID,
  DAME_NATURE_FAMILY_CARD_IDS,
  DAME_NATURE_NATURE_CARD_IDS,
  DAME_NATURE_QUIZ_CARD_IDS,
} from '../model/dame-nature-cards';
import type { DameNatureMetadata } from '../model/dame-nature-state.entity';

@Injectable()
export class DameNatureSetupService {
  constructor(private readonly random: RandomService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const rngSeed = (baseState.metadata ?? {}) as DameNatureMetadata;
    let rngMeta = getRngMeta(rngSeed);

    const { values: shuffledFamilies, meta: updatedMeta } = this.random.shuffle(
      rngMeta,
      DAME_NATURE_FAMILY_CARD_IDS,
    );
    rngMeta = updatedMeta;

    const hands: Record<number, string[]> = {};
    const families: Record<number, Record<string, string[]>> = {};
    const remaining = [...shuffledFamilies];

    for (const player of players) {
      if (!player?.id) continue;
      const hand: string[] = [];
      const familyMap: Record<string, string[]> = {};
      for (let i = 0; i < 5 && remaining.length; i += 1) {
        const cardId = remaining.shift()!;
        hand.push(cardId);
        const familyId =
          (DAME_NATURE_CARD_BY_ID[cardId] as any)?.familyId ?? 'unknown';
        familyMap[familyId] = [...(familyMap[familyId] ?? []), cardId];
      }
      hands[player.id] = hand;
      families[player.id] = familyMap;
    }

    const drawPile = [
      ...remaining,
      ...DAME_NATURE_QUIZ_CARD_IDS,
      ...DAME_NATURE_NATURE_CARD_IDS,
    ];
    const { values: shuffledDeck, meta: finalMeta } = this.random.shuffle(
      rngMeta,
      drawPile,
    );

    const metadata: DameNatureMetadata = {
      rng: finalMeta,
      deck: shuffledDeck,
      discard: [],
      hands,
      families,
      pollutionTokens: 0,
      pollutionLoserId: null,
      lastQuizCardId: null,
      winnerId: null,
    };

    return { ...baseState, metadata };
  }
}
