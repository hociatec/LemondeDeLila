import type { GameStateEntity } from '../../../../../application/models/game-state.model';

import {
  getRngMeta,
  getSafePlayers,
} from '../../../../../application/helpers/setup-service.helper';
import { RandomService } from '../../../../../application/services/random.service';
import {
  GERARD_PRESIDENT_NAMES,
  GERARD_PRESIDENT_SPECIAL_CARDS,
  GERARD_PRESIDENT_THEMES,
} from '../../model/gerard-president-cards';
import type { GerardPresidentMetadata } from '../../model/gerard-president-state.model';
import { GERARD_PRESIDENT_TARGET_SCORE } from '../../model/gerard-president-state.model';

export class GerardPresidentSetupService {
  constructor(private readonly random: RandomService) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const metaSeed = (baseState.metadata ?? {}) as GerardPresidentMetadata;
    const rng = getRngMeta(metaSeed);

    const nameDeck = [...GERARD_PRESIDENT_NAMES];
    const themeDeck = [...GERARD_PRESIDENT_THEMES];
    const specialDeck = GERARD_PRESIDENT_SPECIAL_CARDS.flatMap((card) =>
      Array.from({ length: 2 }, () => card.id),
    );

    const { values: shuffledNames, meta: afterNameShuffle } =
      this.random.shuffle(rng, nameDeck);
    const { values: shuffledThemes, meta: afterThemeShuffle } =
      this.random.shuffle(afterNameShuffle, themeDeck);
    const { values: shuffledSpecials, meta: afterSpecialShuffle } =
      this.random.shuffle(afterThemeShuffle, specialDeck);

    const hands: Record<number, string[]> = {};
    const specialHands: Record<number, string[]> = {};
    const scores: Record<number, number> = {};

    const nameQueue = [...shuffledNames];
    const specialQueue = [...shuffledSpecials];

    for (const player of players) {
      if (!player?.id) {
        continue;
      }
      hands[player.id] = [];
      for (let i = 0; i < 10; i += 1) {
        const card = nameQueue.shift();
        if (!card) break;
        hands[player.id].push(card);
      }
      specialHands[player.id] = [];
      for (let i = 0; i < 2; i += 1) {
        const card = specialQueue.shift();
        if (!card) break;
        specialHands[player.id].push(card);
      }
      scores[player.id] = 0;
    }

    const masterId = players.length > 0 ? (players[0].id ?? null) : null;

    const metadata: GerardPresidentMetadata = {
      rng: afterSpecialShuffle,
      nameDeck: nameQueue,
      themeDeck: shuffledThemes,
      specialDeck: specialQueue,
      nameDiscard: [],
      themeDiscard: [],
      specialDiscard: [],
      hands,
      specialHands,
      scores,
      masterId,
      currentTheme: null,
      secondTheme: null,
      lockedName: null,
      peaceTurnsRemaining: 0,
      winnerId: null,
      roundNumber: 0,
      targetScore: GERARD_PRESIDENT_TARGET_SCORE,
      submissions: {},
      pendingPlayers: [],
      roundPhase: 'waiting_theme',
      specialsPlayed: {},
      extraNamesAllowed: {},
      defenseActive: {},
      specialAttackers: {},
      themeSecretActive: false,
      juryOverrideId: null,
      dominoRemaining: 0,
      ghostNames: [],
    };

    return {
      ...baseState,
      metadata,
      turnIndex: 0,
      turn: {
        currentPlayerId: masterId ?? null,
        direction: 1,
      },
    };
  }
}



