import type { GameEffectInstruction } from './effect-ir';

export type SacMovement =
  | { kind: 'delta'; delta: number }
  | { kind: 'last' | 'next-station' | 'next-community' | 'previous-chance' }
  | { kind: 'start'; collect: boolean }
  | { kind: 'next-group'; groupId: string }
  | { kind: 'tile'; tileId: string; direction: 'forward' | 'backward' };
export type SacCard = {
  id: string;
  text: string;
  effects: readonly GameEffectInstruction[];
  retained: boolean;
};
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
  id: string;
  n: number;
  title: string;
  description?: string;
  type: SacTileType;
  group?: string;
  groupId?: string;
  taxAmount?: number;
};
export type SacGroup = {
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
export type SacStationRules = {
  properties: string[];
  propertyIds: string[];
  purchasePrice: number;
  mortgage: number;
  unmortgageCost: number;
  rents: Record<'1' | '2' | '3' | '4', number>;
};
export type SacUtility = {
  tileId: string;
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
    tileId: string;
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
export type SacProgram = {
  variants: readonly SacVariant[];
};
