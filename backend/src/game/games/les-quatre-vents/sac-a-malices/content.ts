import classicBoard from './model/content/board.json';
import classicChance from './model/content/chance-cards.json';
import classicCommunity from './model/content/community-cards.json';
import classicGroups from './model/content/groups.json';
import classicStations from './model/content/stations.json';
import classicUtilities from './model/content/utilities.json';
import cosmosBoard from './variants/cosmos-credit/model/content/board.json';
import cosmosChance from './variants/cosmos-credit/model/content/chance-cards.json';
import cosmosCommunity from './variants/cosmos-credit/model/content/community-cards.json';
import cosmosGroups from './variants/cosmos-credit/model/content/groups.json';
import cosmosStations from './variants/cosmos-credit/model/content/stations.json';
import cosmosUtilities from './variants/cosmos-credit/model/content/utilities.json';
import gaiaBoard from './variants/gaia/model/content/board.json';
import gaiaChance from './variants/gaia/model/content/chance-cards.json';
import gaiaCommunity from './variants/gaia/model/content/community-cards.json';
import gaiaGroups from './variants/gaia/model/content/groups.json';
import gaiaStations from './variants/gaia/model/content/stations.json';
import gaiaUtilities from './variants/gaia/model/content/utilities.json';
import pintzelBoard from './variants/pintzel-couronnes/model/content/board.json';
import pintzelChance from './variants/pintzel-couronnes/model/content/chance-cards.json';
import pintzelCommunity from './variants/pintzel-couronnes/model/content/community-cards.json';
import pintzelGroups from './variants/pintzel-couronnes/model/content/groups.json';
import pintzelStations from './variants/pintzel-couronnes/model/content/stations.json';
import pintzelUtilities from './variants/pintzel-couronnes/model/content/utilities.json';
import flandresBoard from './variants/route-des-flandres/model/content/board.json';
import flandresChance from './variants/route-des-flandres/model/content/chance-cards.json';
import flandresCommunity from './variants/route-des-flandres/model/content/community-cards.json';
import flandresGroups from './variants/route-des-flandres/model/content/groups.json';
import flandresStations from './variants/route-des-flandres/model/content/stations.json';
import flandresUtilities from './variants/route-des-flandres/model/content/utilities.json';
import sabordBoard from './variants/sabord-quai/model/content/board.json';
import sabordChance from './variants/sabord-quai/model/content/chance-cards.json';
import sabordCommunity from './variants/sabord-quai/model/content/community-cards.json';
import sabordGroups from './variants/sabord-quai/model/content/groups.json';
import sabordStations from './variants/sabord-quai/model/content/stations.json';
import sabordUtilities from './variants/sabord-quai/model/content/utilities.json';
import violetteBoard from './variants/violette-boussole/model/content/board.json';
import violetteChance from './variants/violette-boussole/model/content/chance-cards.json';
import violetteCommunity from './variants/violette-boussole/model/content/community-cards.json';
import violetteGroups from './variants/violette-boussole/model/content/groups.json';
import violetteStations from './variants/violette-boussole/model/content/stations.json';
import violetteUtilities from './variants/violette-boussole/model/content/utilities.json';

export type SacVariantId =
  | 'classic'
  | 'gaia'
  | 'violette-boussole'
  | 'sabord-quai'
  | 'route-des-flandres'
  | 'cosmos-credit'
  | 'pintzel-couronnes';

export type SacTileType =
  | 'start'
  | 'property'
  | 'station'
  | 'utility'
  | 'chance'
  | 'community'
  | 'tax'
  | 'jail'
  | 'go_to_jail'
  | 'free'
  | 'neutral';

export type SacTile = {
  n: number;
  title: string;
  description?: string;
  type: SacTileType;
  group?: string;
};
export type SacCard = { id: number; text: string };
export type SacGroup = {
  color: string;
  properties: string[];
  purchasePrice: number;
  mortgage: number;
  unmortgageCost: number;
  rents: {
    base: number;
    house1: number;
    house2: number;
    house3: number;
    house4: number;
    hotel: number;
  };
  housePrice: number;
  hotelPrice: number;
  housePrices?: Partial<Record<'1' | '2' | '3' | '4', number>>;
};
export type SacStationRules = {
  properties: string[];
  purchasePrice: number;
  mortgage: number;
  unmortgageCost: number;
  rents: Record<'1' | '2' | '3' | '4', number>;
};
export type SacUtility = {
  name: string;
  purchasePrice: number;
  mortgage: number;
  unmortgageCost: number;
  multiplier1: number;
  multiplier2: number;
};
export type SacRules = {
  startMoney: number;
  passStartBonus: number;
  potEnabled: boolean;
  rentBlockedInJail: boolean;
  jail: {
    maxTurns: number;
    autoFine: number;
    allowPayFine: boolean;
    allowDoubleEscape: boolean;
  };
};
export type SacVariant = {
  id: SacVariantId;
  label: string;
  tiles: SacTile[];
  chance: SacCard[];
  community: SacCard[];
  groups: SacGroup[];
  stations: SacStationRules;
  utilities: SacUtility[];
  rules: SacRules;
};

const standardRules: SacRules = {
  startMoney: 2_000,
  passStartBonus: 200,
  potEnabled: true,
  rentBlockedInJail: true,
  jail: {
    maxTurns: 3,
    autoFine: 100,
    allowPayFine: true,
    allowDoubleEscape: false,
  },
};

type RawBundle = {
  board: { tiles: Array<Omit<SacTile, 'type'> & { type: string }> };
  chance: { cards: SacCard[] };
  community: { cards: SacCard[] };
  groups: { groups: SacGroup[] };
  stations: { stations: SacStationRules };
  utilities: { utilities: SacUtility[] };
};

export const SAC_VARIANTS: SacVariant[] = [
  variant('classic', 'Chouette et fortune !', {
    board: classicBoard,
    chance: classicChance,
    community: classicCommunity,
    groups: classicGroups,
    stations: classicStations,
    utilities: classicUtilities,
  }),
  variant(
    'gaia',
    'Gaïa',
    {
      board: gaiaBoard,
      chance: gaiaChance,
      community: gaiaCommunity,
      groups: gaiaGroups,
      stations: gaiaStations,
      utilities: gaiaUtilities,
    },
    greenRules(),
  ),
  variant('violette-boussole', 'Violette & Boussole', {
    board: violetteBoard,
    chance: violetteChance,
    community: violetteCommunity,
    groups: violetteGroups,
    stations: violetteStations,
    utilities: violetteUtilities,
  }),
  variant('sabord-quai', 'Sabord et Quai', {
    board: sabordBoard,
    chance: sabordChance,
    community: sabordCommunity,
    groups: sabordGroups,
    stations: sabordStations,
    utilities: sabordUtilities,
  }),
  variant('route-des-flandres', 'La Route des Flandres', {
    board: flandresBoard,
    chance: flandresChance,
    community: flandresCommunity,
    groups: flandresGroups,
    stations: flandresStations,
    utilities: flandresUtilities,
  }),
  variant(
    'cosmos-credit',
    'Cosmos & Crédit',
    {
      board: cosmosBoard,
      chance: cosmosChance,
      community: cosmosCommunity,
      groups: cosmosGroups,
      stations: cosmosStations,
      utilities: cosmosUtilities,
    },
    cosmosRules(),
  ),
  variant('pintzel-couronnes', 'Pintzel & Couronnes !', {
    board: pintzelBoard,
    chance: pintzelChance,
    community: pintzelCommunity,
    groups: pintzelGroups,
    stations: pintzelStations,
    utilities: pintzelUtilities,
  }),
];

export function sacVariant(id: SacVariantId): SacVariant {
  const selected = SAC_VARIANTS.find((candidate) => candidate.id === id);
  if (!selected) throw new Error(`Variante Sac à Malices inconnue: ${id}`);
  return selected;
}

function variant(
  id: SacVariantId,
  label: string,
  source: RawBundle,
  rules: SacRules = standardRules,
): SacVariant {
  return {
    id,
    label,
    tiles: source.board.tiles.map((tile) => ({
      ...tile,
      type: tileType(tile.type),
    })),
    chance: source.chance.cards.map((card) => ({ ...card })),
    community: source.community.cards.map((card) => ({ ...card })),
    groups: structuredClone(source.groups.groups),
    stations: structuredClone(source.stations.stations),
    utilities: structuredClone(source.utilities.utilities),
    rules: structuredClone(rules),
  };
}

function greenRules(): SacRules {
  return {
    ...standardRules,
    startMoney: 1_500,
    potEnabled: false,
    rentBlockedInJail: false,
  };
}

function cosmosRules(): SacRules {
  return {
    ...greenRules(),
    jail: {
      ...standardRules.jail,
      autoFine: 0,
      allowPayFine: false,
      allowDoubleEscape: true,
    },
  };
}

function tileType(value: string): SacTileType {
  const values: SacTileType[] = [
    'start',
    'property',
    'station',
    'utility',
    'chance',
    'community',
    'tax',
    'jail',
    'go_to_jail',
    'free',
    'neutral',
  ];
  const found = values.find((candidate) => candidate === value);
  if (!found) throw new Error(`Type de case Sac à Malices invalide: ${value}`);
  return found;
}
