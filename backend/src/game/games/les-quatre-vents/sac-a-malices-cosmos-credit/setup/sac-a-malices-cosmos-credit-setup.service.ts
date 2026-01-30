import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import type {
  SacBoardJsonV1,
  SacCardsJsonV1,
  SacGroupsJsonV1,
  SacMetadata,
  SacStationsJsonV1,
  SacUtilitiesJsonV1,
} from '../../sac-a-malices/model/sac-a-malices.types';

@Injectable()
export class SacAMalicesCosmosCreditSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const groups = this.loadGroups();
    const stations = this.loadStations();
    const utilities = this.loadUtilities();
    const chance = this.loadCards('chance-cards.json');
    const community = this.loadCards('community-cards.json');

    const players = Array.isArray(base.players) ? base.players : [];
    const positions: Record<number, number> = {};
    const money: Record<number, number> = {};
    for (const p of players) {
      positions[p.id] = 0;
      money[p.id] = 1500;
    }

    const seedMeta = (base.metadata ?? {}) as any;
    const s1 = this.random.shuffle(seedMeta, chance.cards ?? []);
    const s2 = this.random.shuffle(s1.meta, community.cards ?? []);

    const meta: SacMetadata = {
      tiles: board.tiles ?? [],
      positions,
      money,
      ownership: {},
      buildings: {},
      statuses: {
        skipTurn: {},
        inJail: {},
        eliminated: {},
        getOutOfJail: {},
        extraRoll: {},
        consecutiveDoubles: {},
      },
      pot: 0,
      rules: {
        startMoney: 1500,
        passStartBonus: 200,
        potEnabled: false,
        rentBlockedInJail: false,
        jail: {
          maxTurns: 3,
          autoFine: 0,
          allowPayFine: false,
          allowDoubleEscape: true,
        },
      },
      decks: {
        chance: { cards: s1.values as any, discard: [] },
        community: { cards: s2.values as any, discard: [] },
      },
      data: {
        groups: groups.groups ?? [],
        stations: stations.stations,
        utilities: utilities.utilities ?? [],
      },
      winnerId: null,
    };

    return {
      ...base,
      phase: 'playing',
      pending: null,
      metadata: {
        ...(base.metadata ?? {}),
        ...s2.meta,
        ...meta,
      },
    };
  }

  private loadBoard(): SacBoardJsonV1 {
    return this.contentLoader.loadContent<SacBoardJsonV1>({
      gameType: 'sac-a-malices-cosmos-credit',
      baseDir: __dirname,
      filename: 'board.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('tiles', 1),
      ],
    });
  }

  private loadGroups(): SacGroupsJsonV1 {
    return this.contentLoader.loadContent<SacGroupsJsonV1>({
      gameType: 'sac-a-malices-cosmos-credit',
      baseDir: __dirname,
      filename: 'groups.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('groups', 1),
      ],
    });
  }

  private loadStations(): SacStationsJsonV1 {
    return this.contentLoader.loadContent<SacStationsJsonV1>({
      gameType: 'sac-a-malices-cosmos-credit',
      baseDir: __dirname,
      filename: 'stations.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.requiredFields('stations'),
      ],
    });
  }

  private loadUtilities(): SacUtilitiesJsonV1 {
    return this.contentLoader.loadContent<SacUtilitiesJsonV1>({
      gameType: 'sac-a-malices-cosmos-credit',
      baseDir: __dirname,
      filename: 'utilities.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('utilities', 0),
      ],
    });
  }

  private loadCards(filename: string): SacCardsJsonV1 {
    return this.contentLoader.loadContent<SacCardsJsonV1>({
      gameType: 'sac-a-malices-cosmos-credit',
      baseDir: __dirname,
      filename,
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('cards', 1),
      ],
    });
  }
}

