import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  sacVariant,
  type SacGroup,
  type SacTile,
  type SacVariant,
} from './content';
import type { SacBuilding, SacState } from './state';

type RuleContext = GameRuleContext<SacState>;
const TRACK = 'city';

export function changeMoney(
  state: SacState,
  playerId: number,
  delta: number,
  toPot: boolean,
  ctx: RuleContext,
): void {
  if (state.eliminated[playerId]) return;
  state.money[playerId] += delta;
  const rules = sacVariant(state.variantId).rules;
  if (toPot && delta < 0 && rules.potEnabled) state.pot += -delta;
  if (state.money[playerId] >= 0) return;
  state.money[playerId] = 0;
  state.eliminated[playerId] = true;
  for (const [tileIndex, ownerId] of Object.entries(state.ownership)) {
    if (ownerId === playerId) {
      delete state.ownership[Number(tileIndex)];
      delete state.buildings[Number(tileIndex)];
    }
  }
  ctx.history.add(`${ctx.players.get(playerId)?.username} est en faillite.`);
  updateWinner(state, ctx);
}

export function updateWinner(state: SacState, ctx: RuleContext): void {
  const alive = ctx.players
    .all()
    .filter((player) => !state.eliminated[player.id]);
  if (alive.length === 1) state.winnerId = alive[0].id;
}

export function sendToJail(
  state: SacState,
  playerId: number,
  ctx: RuleContext,
): void {
  const variant = sacVariant(state.variantId);
  const jail = variant.tiles.findIndex((tile) => tile.type === 'jail');
  if (jail >= 0) moveTo(playerId, jail, ctx);
  state.jailTurns[playerId] = variant.rules.jail.maxTurns;
  state.extraRoll[playerId] = false;
}

export function collectPot(
  state: SacState,
  playerId: number,
  variant: SacVariant,
  ctx: RuleContext,
): void {
  if (!variant.rules.potEnabled || state.pot <= 0) return;
  const amount = state.pot;
  state.pot = 0;
  changeMoney(state, playerId, amount, false, ctx);
}

export function payTax(
  state: SacState,
  playerId: number,
  tile: SacTile,
  ctx: RuleContext,
): void {
  const amount = Number(
    `${tile.title} ${tile.description ?? ''}`.match(/(\d+)/)?.[1] ?? 0,
  );
  if (amount > 0) changeMoney(state, playerId, -amount, true, ctx);
}

export function loseInfrastructure(
  state: SacState,
  playerId: number,
  ctx: RuleContext,
): void {
  const candidates = Object.entries(state.buildings)
    .filter(
      ([tileIndex, building]) =>
        state.ownership[Number(tileIndex)] === playerId &&
        (building.hotel || building.houses > 0),
    )
    .map(([tileIndex]) => Number(tileIndex));
  const selected = ctx.random.pick(candidates);
  if (selected == null) return;
  const building = buildingAt(state, selected);
  if (building.hotel) building.hotel = false;
  else building.houses = Math.max(0, building.houses - 1);
}

export function purchasePrice(variant: SacVariant, tile: SacTile): number {
  if (tile.type === 'station') return variant.stations.purchasePrice;
  if (tile.type === 'utility')
    return (
      variant.utilities.find((utility) => sameName(utility.name, tile.title))
        ?.purchasePrice ?? 0
    );
  return groupFor(variant, tile)?.purchasePrice ?? 0;
}

export function rentFor(
  state: SacState,
  tileIndex: number,
  tile: SacTile,
  ownerId: number,
): number {
  const variant = sacVariant(state.variantId);
  if (tile.type === 'station') {
    const count = variant.tiles.filter(
      (candidate, index) =>
        candidate.type === 'station' && state.ownership[index] === ownerId,
    ).length;
    return variant.stations.rents[
      String(Math.max(1, Math.min(4, count))) as '1' | '2' | '3' | '4'
    ];
  }
  if (tile.type === 'utility') {
    const owned = variant.tiles.filter(
      (candidate, index) =>
        candidate.type === 'utility' && state.ownership[index] === ownerId,
    ).length;
    const utility = variant.utilities.find((candidate) =>
      sameName(candidate.name, tile.title),
    );
    return (
      state.lastRoll *
      (owned >= 2 ? (utility?.multiplier2 ?? 10) : (utility?.multiplier1 ?? 4))
    );
  }
  const group = groupFor(variant, tile);
  if (!group) return 0;
  const building = buildingAt(state, tileIndex);
  if (building.hotel) return group.rents.hotel;
  return [
    group.rents.base,
    group.rents.house1,
    group.rents.house2,
    group.rents.house3,
    group.rents.house4,
  ][building.houses];
}

export function groupFor(variant: SacVariant, tile: SacTile): SacGroup | null {
  return (
    variant.groups.find(
      (group) => normalize(group.color) === normalize(tile.group ?? ''),
    ) ?? null
  );
}

export function ownsGroup(
  state: SacState,
  playerId: number,
  variant: SacVariant,
  group: SacGroup,
): boolean {
  return group.properties.every((name) => {
    const tileIndex = variant.tiles.findIndex((tile) =>
      sameName(name, tile.title),
    );
    return tileIndex >= 0 && state.ownership[tileIndex] === playerId;
  });
}

export function mortgageValue(variant: SacVariant, tile: SacTile): number {
  if (tile.type === 'station') return variant.stations.mortgage;
  if (tile.type === 'utility')
    return (
      variant.utilities.find((utility) => sameName(utility.name, tile.title))
        ?.mortgage ?? 0
    );
  return groupFor(variant, tile)?.mortgage ?? 0;
}

export function unmortgageCost(variant: SacVariant, tile: SacTile): number {
  if (tile.type === 'station') return variant.stations.unmortgageCost;
  if (tile.type === 'utility')
    return (
      variant.utilities.find((utility) => sameName(utility.name, tile.title))
        ?.unmortgageCost ?? 0
    );
  return groupFor(variant, tile)?.unmortgageCost ?? 0;
}

export function buildCost(group: SacGroup, building: SacBuilding): number {
  return building.houses >= 4
    ? group.hotelPrice
    : houseCost(group, building.houses + 1);
}

export function houseCost(group: SacGroup, level: number): number {
  const key = String(Math.max(1, Math.min(4, level))) as '1' | '2' | '3' | '4';
  return group.housePrices?.[key] ?? group.housePrice;
}

export function buildingAt(state: SacState, tileIndex: number): SacBuilding {
  return (state.buildings[tileIndex] ??= {
    houses: 0,
    hotel: false,
    mortgaged: false,
  });
}

export function movementDelta(text: string): number {
  const match = text.match(
    /(avancez|reculez) (?:de |d['’])?(\d+|un|une|deux|trois|quatre|cinq|six) cases?/i,
  );
  if (!match) return 0;
  const values: Record<string, number> = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
  };
  const amount = Number(match[2]) || values[match[2]] || 0;
  return match[1].startsWith('recule') ? -amount : amount;
}

export function moneyDelta(text: string): number {
  const gain = text.match(/(?:recevez|recois|gagnez|gagne|empochez) (\d+)/i);
  if (gain) return Number(gain[1]);
  const loss = text.match(/(?:payez|paie|paye|perdez) (\d+)/i);
  return loss ? -Number(loss[1]) : 0;
}

export function skipTurns(text: string): number {
  if (
    !text.includes('passez') &&
    !text.includes('passe ton') &&
    !text.includes('passe votre')
  )
    return 0;
  if (text.includes('trois tour')) return 3;
  if (text.includes('deux tour')) return 2;
  return 1;
}

export function nextTileOfType(
  variant: SacVariant,
  current: number,
  type: SacTile['type'],
  direction: 1 | -1,
): number | null {
  for (let distance = 1; distance < variant.tiles.length; distance += 1) {
    const index = modulo(current + distance * direction, variant.tiles.length);
    if (variant.tiles[index].type === type) return index;
  }
  return null;
}

export function nextGroupTile(
  variant: SacVariant,
  current: number,
  group: string,
): number | null {
  for (let distance = 1; distance < variant.tiles.length; distance += 1) {
    const index = modulo(current + distance, variant.tiles.length);
    if (normalize(variant.tiles[index].group ?? '') === normalize(group))
      return index;
  }
  return null;
}

export function findTile(
  variant: SacVariant,
  name: string,
  direction: number,
): number | null {
  const normalized = normalize(name).replace(/^(case|gare de) /, '');
  const index = variant.tiles.findIndex((tile) =>
    normalize(tile.title).includes(normalized),
  );
  if (index >= 0) return index;
  if (direction < 0) return nextTileOfType(variant, 0, 'chance', -1);
  return null;
}

export function isOwnable(tile: SacTile): boolean {
  return (
    tile.type === 'property' ||
    tile.type === 'station' ||
    tile.type === 'utility'
  );
}

export function position(playerId: number, ctx: RuleContext): number {
  return ctx.movement.position(TRACK, playerId);
}

export function moveTo(
  playerId: number,
  target: number,
  ctx: RuleContext,
): void {
  ctx.movement.move(TRACK, playerId, target - position(playerId, ctx));
}

export function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function sameName(left: string, right: string): boolean {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right)
    .replace(/\([^)]*\)/g, '')
    .trim();
  return (
    normalizedLeft === normalizedRight ||
    normalizedRight.includes(normalizedLeft)
  );
}

export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
