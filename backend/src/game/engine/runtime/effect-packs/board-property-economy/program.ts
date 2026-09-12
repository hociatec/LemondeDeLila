import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type PropertyEconomyMovement =
  | { kind: 'delta'; delta: number }
  | { kind: 'last' | 'next-station' | 'next-community' | 'previous-chance' }
  | { kind: 'start'; collect: boolean }
  | { kind: 'next-group'; groupId: string }
  | { kind: 'tile'; tileId: string; direction: 'forward' | 'backward' };
export type PropertyEconomyCard = {
  id: string;
  text: string;
  effects: readonly GameEffectInstruction[];
  retained: boolean;
};
export type PropertyEconomyVariantId =
  | 'classic'
  | 'gaia'
  | 'violette-boussole'
  | 'sabord-quai'
  | 'route-des-flandres'
  | 'cosmos-credit'
  | 'pintzel-couronnes';
export type PropertyEconomyTileType =
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
export type PropertyEconomyTile = {
  id: string;
  n: number;
  title: string;
  description?: string;
  type: PropertyEconomyTileType;
  group?: string;
  groupId?: string;
  taxAmount?: number;
};
export type PropertyEconomyGroup = {
  id: string;
  color: string;
  properties: string[];
  propertyIds: string[];
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
export type PropertyEconomyStationRules = {
  properties: string[];
  propertyIds: string[];
  purchasePrice: number;
  mortgage: number;
  unmortgageCost: number;
  rents: Record<'1' | '2' | '3' | '4', number>;
};
export type PropertyEconomyUtility = {
  tileId: string;
  name: string;
  purchasePrice: number;
  mortgage: number;
  unmortgageCost: number;
  multiplier1: number;
  multiplier2: number;
};
export type PropertyEconomyRules = {
  startMoney: number;
  passStartBonus: number;
  potEnabled: boolean;
  rentBlockedInJail: boolean;
  jail: {
    tileId: string;
    maxTurns: number;
    autoFine: number;
    allowPayFine: boolean;
    allowDoubleEscape: boolean;
  };
};
export type PropertyEconomyVariant = {
  id: PropertyEconomyVariantId;
  label: string;
  tiles: PropertyEconomyTile[];
  chance: PropertyEconomyCard[];
  community: PropertyEconomyCard[];
  groups: PropertyEconomyGroup[];
  stations: PropertyEconomyStationRules;
  utilities: PropertyEconomyUtility[];
  rules: PropertyEconomyRules;
};
export type PropertyEconomyProgram = {
  variants: readonly PropertyEconomyVariant[];
};
