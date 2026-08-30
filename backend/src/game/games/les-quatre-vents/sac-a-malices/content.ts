import {
  freezeGameContent,
  gameEffects,
  rejectContent,
} from '../../../engine/sdk/public-api';
import type { GameEffectInstruction } from '../../../engine/sdk/public-api';
import { moneyDelta, movementDelta, normalize, skipTurns } from './text-parser';
import * as variantContent from './variant-content';

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
export type SacMovement =
  | { kind: 'delta'; delta: number }
  | { kind: 'last' | 'next-station' | 'next-community' | 'previous-chance' }
  | { kind: 'start'; collect: boolean }
  | { kind: 'next-group'; group: string }
  | { kind: 'named'; name: string; direction: 'forward' | 'backward' };
export type SacCard = {
  id: string | number;
  text: string;
  effects: readonly GameEffectInstruction[];
  retained: boolean;
};
type RawSacCard = Omit<SacCard, 'effects' | 'retained'>;
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
  chance: { cards: RawSacCard[] };
  community: { cards: RawSacCard[] };
  groups: { groups: SacGroup[] };
  stations: { stations: SacStationRules };
  utilities: { utilities: SacUtility[] };
};

export const SAC_VARIANTS: SacVariant[] = [
  variant('classic', 'Chouette et fortune !', {
    board: variantContent.classicBoard,
    chance: variantContent.classicChance,
    community: variantContent.classicCommunity,
    groups: variantContent.classicGroups,
    stations: variantContent.classicStations,
    utilities: variantContent.classicUtilities,
  }),
  variant(
    'gaia',
    'Gaïa',
    {
      board: variantContent.gaiaBoard,
      chance: variantContent.gaiaChance,
      community: variantContent.gaiaCommunity,
      groups: variantContent.gaiaGroups,
      stations: variantContent.gaiaStations,
      utilities: variantContent.gaiaUtilities,
    },
    greenRules(),
  ),
  variant('violette-boussole', 'Violette & Boussole', {
    board: variantContent.violetteBoard,
    chance: variantContent.violetteChance,
    community: variantContent.violetteCommunity,
    groups: variantContent.violetteGroups,
    stations: variantContent.violetteStations,
    utilities: variantContent.violetteUtilities,
  }),
  variant('sabord-quai', 'Sabord et Quai', {
    board: variantContent.sabordBoard,
    chance: variantContent.sabordChance,
    community: variantContent.sabordCommunity,
    groups: variantContent.sabordGroups,
    stations: variantContent.sabordStations,
    utilities: variantContent.sabordUtilities,
  }),
  variant('route-des-flandres', 'La Route des Flandres', {
    board: variantContent.flandresBoard,
    chance: variantContent.flandresChance,
    community: variantContent.flandresCommunity,
    groups: variantContent.flandresGroups,
    stations: variantContent.flandresStations,
    utilities: variantContent.flandresUtilities,
  }),
  variant(
    'cosmos-credit',
    'Cosmos & Crédit',
    {
      board: variantContent.cosmosBoard,
      chance: variantContent.cosmosChance,
      community: variantContent.cosmosCommunity,
      groups: variantContent.cosmosGroups,
      stations: variantContent.cosmosStations,
      utilities: variantContent.cosmosUtilities,
    },
    cosmosRules(),
  ),
  variant('pintzel-couronnes', 'Pintzel & Couronnes !', {
    board: variantContent.pintzelBoard,
    chance: variantContent.pintzelChance,
    community: variantContent.pintzelCommunity,
    groups: variantContent.pintzelGroups,
    stations: variantContent.pintzelStations,
    utilities: variantContent.pintzelUtilities,
  }),
];

export function sacVariant(id: SacVariantId): SacVariant {
  const selected = SAC_VARIANTS.find((candidate) => candidate.id === id);
  if (!selected) rejectContent(`Variante Sac à Malices inconnue: ${id}`);
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
    chance: source.chance.cards.map(decorateCard),
    community: source.community.cards.map(decorateCard),
    groups: structuredClone(source.groups.groups),
    stations: structuredClone(source.stations.stations),
    utilities: structuredClone(source.utilities.utilities),
    rules: structuredClone(rules),
  };
}

function decorateCard(card: RawSacCard): SacCard {
  const text = normalize(card.text);
  const retained =
    text.includes('sortie de prison') ||
    (text.includes('gardez cette carte') && text.includes('prison'));
  return {
    ...card,
    retained,
    effects: retained
      ? [gameEffects.gainResource('sac.jail-cards', 1)]
      : cardInstructions(text),
  };
}

function cardInstructions(text: string): readonly GameEffectInstruction[] {
  const effects: GameEffectInstruction[] = [];
  if (text.includes('perd') && text.includes('infrastructure')) {
    effects.push(gameEffects.custom('sac.lose-infrastructure'));
  }
  const everyone = text.match(
    /tous les joueurs (?:paient|payent|recoivent) (\d+)/i,
  );
  if (everyone) {
    const amount = Number(everyone[1]);
    effects.push(
      gameEffects.custom('sac.everyone-money', {
        delta: /recoivent/i.test(everyone[0]) ? amount : -amount,
      }),
    );
  }
  const movement = parseMovement(text);
  if (movement) effects.push(gameEffects.custom('sac.movement', { movement }));
  const skippedTurns = skipTurns(text);
  if (skippedTurns > 0) effects.push(gameEffects.skipTurn(skippedTurns));
  const money = moneyDelta(text);
  if (money !== 0 && !text.includes('tous les joueurs')) {
    effects.push(gameEffects.custom('sac.money', { delta: money }));
  }
  if (text.includes('rejou')) effects.push(gameEffects.extraTurn());
  return effects;
}

function parseMovement(text: string): SacMovement | null {
  const delta = movementDelta(text);
  if (delta !== 0) return { kind: 'delta', delta };
  if (
    !text.includes('avance') &&
    !text.includes('recule') &&
    !text.includes('retour')
  ) {
    return null;
  }
  if (text.includes('derniere case')) return { kind: 'last' };
  if (text.includes('case depart') || text.includes('case depare')) {
    return { kind: 'start', collect: text.includes('empoche') };
  }
  if (text.includes('prochaine gare')) return { kind: 'next-station' };
  if (text.includes('prochaine caisse')) return { kind: 'next-community' };
  if (text.includes('precedente chance')) return { kind: 'previous-chance' };
  const group = text.match(/prochaine case ([a-z]+)/)?.[1];
  if (group) return { kind: 'next-group', group };
  const name = text.match(
    /(?:jusqu['’]?a|directement a|avancez a) (?:la |le |l['’])?([^.,:]+)/,
  )?.[1];
  if (!name || name.includes('cette case')) return null;
  return {
    kind: 'named',
    name,
    direction: text.includes('recule') ? 'backward' : 'forward',
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
  if (!found) rejectContent(`Type de case Sac à Malices invalide: ${value}`);
  return found;
}

freezeGameContent(SAC_VARIANTS);
