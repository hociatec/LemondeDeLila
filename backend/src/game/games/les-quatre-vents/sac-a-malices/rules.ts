import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  SAC_VARIANTS,
  sacVariant,
  type SacCard,
  type SacTile,
  type SacVariantId,
} from './content';
import {
  buildCost,
  buildingAt,
  changeMoney,
  collectPot,
  findTile,
  groupFor,
  houseCost,
  isOwnable,
  loseInfrastructure,
  modulo,
  moneyDelta,
  mortgageValue,
  moveTo,
  movementDelta,
  nextGroupTile,
  nextTileOfType,
  normalize,
  ownsGroup,
  payTax,
  position,
  purchasePrice,
  rentFor,
  sendToJail,
  skipTurns,
  unmortgageCost,
  updateWinner,
} from './economy';
import type { SacManagementKind, SacState } from './state';

type RuleContext = GameRuleContext<SacState>;
const MAX_CHAIN_DEPTH = 24;
const VARIANT_IDS = SAC_VARIANTS.map((variant) => variant.id);

export const selectVariant = defineAction<
  SacState,
  { variantId: SacVariantId }
>({
  input: gameInput.object({ variantId: gameInput.enum(VARIANT_IDS) }),
  documentation: 'Choisit le plateau et les règles économiques de la partie.',
  available: ({ state, ctx }) => !state.configured && ctx.phase() === 'setup',
  availableInputs: () =>
    SAC_VARIANTS.map((variant) => ({ variantId: variant.id })),
  execute: ({ state, input, ctx }) => {
    const selected = sacVariant(input.variantId);
    state.variantId = selected.id;
    state.configured = true;
    for (const player of ctx.players.all())
      state.money[player.id] = selected.rules.startMoney;
    ctx.transitionTo('playing');
    ctx.history.add(`Variante choisie : ${selected.label}.`);
  },
});

export const roll = defineAction<SacState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance deux dés, déplace le pion et résout la case.',
  available: ({ state, actor }) =>
    state.configured && !state.eliminated[actor.id],
  execute: ({ state, actor, ctx }) => {
    if (state.jailTurns[actor.id] > 0) {
      resolveJailTurn(state, actor.id, ctx);
      return;
    }
    const [first, second] = rollPair(ctx);
    state.lastRoll = first + second;
    const isDouble = first === second;
    state.consecutiveDoubles[actor.id] = isDouble
      ? state.consecutiveDoubles[actor.id] + 1
      : 0;
    ctx.history.add(
      `${actor.username} lance ${first} + ${second} = ${state.lastRoll}.`,
    );
    if (state.consecutiveDoubles[actor.id] >= 3) {
      state.consecutiveDoubles[actor.id] = 0;
      sendToJail(state, actor.id, ctx);
      completeTurn(state, actor.id, ctx);
      return;
    }
    state.extraRoll[actor.id] = isDouble;
    moveForward(state, actor.id, state.lastRoll, 0, ctx);
    completeTurn(state, actor.id, ctx);
  },
});

export const build = managementAction('build');
export const sellBuilding = managementAction('sell');
export const mortgage = managementAction('mortgage');
export const unmortgage = managementAction('unmortgage');

export const payFine = defineAction<SacState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Paie l’amende de prison lorsque la variante le permet.',
  available: ({ state, actor }) => {
    const rules = sacVariant(state.variantId).rules;
    return (
      state.configured &&
      state.jailTurns[actor.id] > 0 &&
      rules.jail.allowPayFine &&
      state.money[actor.id] >= rules.jail.autoFine
    );
  },
  execute: ({ state, actor, ctx }) => {
    const fine = sacVariant(state.variantId).rules.jail.autoFine;
    changeMoney(state, actor.id, -fine, true, ctx);
    state.jailTurns[actor.id] = 0;
    ctx.history.add(`${actor.username} paie ${fine} pour sortir de prison.`);
  },
});

export const useJailCard = defineAction<SacState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Utilise une carte de sortie de prison conservée.',
  available: ({ state, actor }) =>
    state.configured &&
    state.jailTurns[actor.id] > 0 &&
    state.jailCards[actor.id] > 0,
  execute: ({ state, actor, ctx }) => {
    state.jailCards[actor.id] -= 1;
    state.jailTurns[actor.id] = 0;
    ctx.history.add(`${actor.username} utilise une carte de sortie de prison.`);
  },
});

export const SAC_ACTIONS = {
  selectVariant,
  roll,
  build,
  sell_building: sellBuilding,
  mortgage,
  unmortgage,
  pay_fine: payFine,
  use_jail_card: useJailCard,
};

export function resolvePurchase(
  state: SacState,
  decision: string,
  ctx: RuleContext,
): void {
  const pending = state.pendingPurchase;
  if (!pending) throw new Error('Achat Sac à Malices absent');
  state.pendingPurchase = null;
  if (decision === 'buy')
    buyTile(state, pending.playerId, pending.tileIndex, ctx);
  else if (decision !== 'skip') throw new Error('Décision d’achat invalide');
  completeTurn(state, pending.playerId, ctx);
}

export function resolveManagement(
  state: SacState,
  tileIndex: number,
  ctx: RuleContext,
): void {
  const pending = state.pendingManagement;
  if (!pending) throw new Error('Gestion Sac à Malices absente');
  if (
    !managementOptions(state, pending.playerId, pending.kind).includes(
      tileIndex,
    )
  )
    throw new Error('Propriété Sac à Malices invalide');
  state.pendingManagement = null;
  applyManagement(state, pending.playerId, pending.kind, tileIndex, ctx);
}

export function skipEliminatedOrBlocked(
  state: SacState,
  ctx: RuleContext,
): void {
  const player = ctx.players.current();
  if (!player) return;
  if (state.skipTurns[player.id] > 0) {
    state.skipTurns[player.id] -= 1;
    ctx.history.add(`${player.username} passe son tour.`);
  }
  ctx.turn.end();
}

function managementAction(kind: SacManagementKind) {
  return defineAction<SacState, Record<string, never>>({
    input: gameInput.object({}),
    documentation: `Ouvre le choix de propriété pour l’opération ${kind}.`,
    available: ({ state, actor }) =>
      state.configured && managementOptions(state, actor.id, kind).length > 0,
    execute: ({ state, actor, ctx }) => {
      const options = managementOptions(state, actor.id, kind);
      state.pendingManagement = { playerId: actor.id, kind };
      ctx.choice.one({
        id: 'sac.management',
        player: actor.id,
        options,
        label: (tileIndex) =>
          sacVariant(state.variantId).tiles[tileIndex]?.title ??
          String(tileIndex),
      });
    },
  });
}

function resolveJailTurn(
  state: SacState,
  playerId: number,
  ctx: RuleContext,
): void {
  const rules = sacVariant(state.variantId).rules;
  if (rules.jail.allowDoubleEscape) {
    const [first, second] = rollPair(ctx);
    state.lastRoll = first + second;
    if (first === second) {
      state.jailTurns[playerId] = 0;
      state.extraRoll[playerId] = true;
      moveForward(state, playerId, state.lastRoll, 0, ctx);
      completeTurn(state, playerId, ctx);
      return;
    }
  }
  state.jailTurns[playerId] = Math.max(0, state.jailTurns[playerId] - 1);
  if (state.jailTurns[playerId] === 0 && rules.jail.autoFine > 0)
    changeMoney(state, playerId, -rules.jail.autoFine, true, ctx);
  state.extraRoll[playerId] = false;
  completeTurn(state, playerId, ctx);
}

function rollPair(ctx: RuleContext): [number, number] {
  const result = ctx.dice.roll('pair').values;
  return [result[0], result[1]];
}

function moveForward(
  state: SacState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_CHAIN_DEPTH || state.eliminated[playerId]) return;
  const variant = sacVariant(state.variantId);
  const current = position(playerId, ctx);
  const raw = current + delta;
  if (delta > 0 && raw >= variant.tiles.length) {
    const passages = Math.floor(raw / variant.tiles.length);
    changeMoney(
      state,
      playerId,
      variant.rules.passStartBonus * passages,
      false,
      ctx,
    );
  }
  moveTo(playerId, modulo(raw, variant.tiles.length), ctx);
  resolveLanding(state, playerId, depth + 1, ctx);
}

function resolveLanding(
  state: SacState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_CHAIN_DEPTH || state.eliminated[playerId]) return;
  const variant = sacVariant(state.variantId);
  const tileIndex = position(playerId, ctx);
  const tile = variant.tiles[tileIndex];
  ctx.history.add(
    `${ctx.players.get(playerId)?.username} arrive sur « ${tile.title} ».`,
  );
  if (tile.type === 'go_to_jail') sendToJail(state, playerId, ctx);
  else if (tile.type === 'free') collectPot(state, playerId, variant, ctx);
  else if (tile.type === 'tax') payTax(state, playerId, tile, ctx);
  else if (tile.type === 'chance' || tile.type === 'community')
    drawAndApply(state, playerId, tile.type, depth, ctx);
  else if (isOwnable(tile))
    resolveOwnable(state, playerId, tileIndex, tile, ctx);
}

function resolveOwnable(
  state: SacState,
  playerId: number,
  tileIndex: number,
  tile: SacTile,
  ctx: RuleContext,
): void {
  const ownerId = state.ownership[tileIndex];
  if (ownerId == null) {
    const price = purchasePrice(sacVariant(state.variantId), tile);
    state.pendingPurchase = { playerId, tileIndex };
    ctx.choice.one({
      id: 'sac.purchase',
      player: playerId,
      options: state.money[playerId] >= price ? ['buy', 'skip'] : ['skip'],
      label: (choice) =>
        choice === 'buy' ? `Acheter pour ${price}` : 'Passer',
    });
    return;
  }
  if (ownerId === playerId || state.buildings[tileIndex]?.mortgaged) return;
  const rules = sacVariant(state.variantId).rules;
  if (rules.rentBlockedInJail && state.jailTurns[ownerId] > 0) return;
  const rent = rentFor(state, tileIndex, tile, ownerId);
  changeMoney(state, playerId, -rent, false, ctx);
  if (!state.eliminated[ownerId]) changeMoney(state, ownerId, rent, false, ctx);
  ctx.history.add(
    `Loyer de ${rent} payé à ${ctx.players.get(ownerId)?.username}.`,
  );
}

function drawAndApply(
  state: SacState,
  playerId: number,
  deck: 'chance' | 'community',
  depth: number,
  ctx: RuleContext,
): void {
  const deckId = `${deck}:${state.variantId}`;
  const card = ctx.cards.drawOrRecycle<SacCard>(deckId);
  if (!card) return;
  ctx.history.add(
    `${deck === 'chance' ? 'Chance' : 'Communauté'} : ${card.text}`,
  );
  const retained = applyCard(state, playerId, card, depth + 1, ctx);
  if (!retained) ctx.cards.discard(deckId, card);
}

function applyCard(
  state: SacState,
  playerId: number,
  card: SacCard,
  depth: number,
  ctx: RuleContext,
): boolean {
  const text = normalize(card.text);
  if (
    text.includes('sortie de prison') ||
    (text.includes('gardez cette carte') && text.includes('prison'))
  ) {
    state.jailCards[playerId] += 1;
    return true;
  }
  if (text.includes('perd') && text.includes('infrastructure'))
    loseInfrastructure(state, playerId, ctx);
  applyEveryoneMoney(state, text, ctx);
  applyCardMovement(state, playerId, card.text, depth, ctx);
  const skip = skipTurns(text);
  if (skip > 0) state.skipTurns[playerId] += skip;
  const money = moneyDelta(text);
  if (money !== 0 && !text.includes('tous les joueurs'))
    changeMoney(state, playerId, money, money < 0, ctx);
  if (text.includes('rejou')) state.extraRoll[playerId] = true;
  return false;
}

function applyEveryoneMoney(
  state: SacState,
  text: string,
  ctx: RuleContext,
): void {
  const match = text.match(
    /tous les joueurs (?:paient|payent|recoivent) (\d+)/i,
  );
  if (!match) return;
  const amount = Number(match[1]);
  const delta = /recoivent/i.test(match[0]) ? amount : -amount;
  for (const player of ctx.players.all())
    if (!state.eliminated[player.id])
      changeMoney(state, player.id, delta, delta < 0, ctx);
}

function applyCardMovement(
  state: SacState,
  playerId: number,
  rawText: string,
  depth: number,
  ctx: RuleContext,
): void {
  const text = normalize(rawText);
  const delta = movementDelta(text);
  if (delta !== 0) {
    moveForward(state, playerId, delta, depth, ctx);
    return;
  }
  const target = movementTarget(state, playerId, text, ctx);
  if (target == null) return;
  const current = position(playerId, ctx);
  const collectStart =
    (target === 0 && text.includes('empoche')) || target < current;
  if (collectStart)
    changeMoney(
      state,
      playerId,
      sacVariant(state.variantId).rules.passStartBonus,
      false,
      ctx,
    );
  moveTo(playerId, target, ctx);
  resolveLanding(state, playerId, depth + 1, ctx);
}

function movementTarget(
  state: SacState,
  playerId: number,
  text: string,
  ctx: RuleContext,
): number | null {
  if (
    !text.includes('avance') &&
    !text.includes('recule') &&
    !text.includes('retour')
  )
    return null;
  const variant = sacVariant(state.variantId);
  if (text.includes('derniere case')) return variant.tiles.length - 1;
  if (text.includes('case depart') || text.includes('case depare')) return 0;
  const direction = text.includes('recule') ? -1 : 1;
  if (text.includes('prochaine gare'))
    return nextTileOfType(variant, position(playerId, ctx), 'station', 1);
  if (text.includes('prochaine caisse'))
    return nextTileOfType(variant, position(playerId, ctx), 'community', 1);
  if (text.includes('precedente chance'))
    return nextTileOfType(variant, position(playerId, ctx), 'chance', -1);
  const color = text.match(/prochaine case ([a-z]+)/)?.[1];
  if (color) return nextGroupTile(variant, position(playerId, ctx), color);
  const named = text.match(
    /(?:jusqu['’]?a|directement a|avancez a) (?:la |le |l['’])?([^.,:]+)/,
  )?.[1];
  if (!named || named.includes('cette case')) return null;
  return findTile(variant, named, direction);
}

function buyTile(
  state: SacState,
  playerId: number,
  tileIndex: number,
  ctx: RuleContext,
): void {
  const variant = sacVariant(state.variantId);
  const tile = variant.tiles[tileIndex];
  const price = purchasePrice(variant, tile);
  if (
    state.ownership[tileIndex] != null ||
    price <= 0 ||
    state.money[playerId] < price
  )
    return;
  changeMoney(state, playerId, -price, false, ctx);
  state.ownership[tileIndex] = playerId;
  state.buildings[tileIndex] = { houses: 0, hotel: false, mortgaged: false };
  ctx.history.add(
    `${ctx.players.get(playerId)?.username} achète « ${tile.title} » pour ${price}.`,
  );
}

function managementOptions(
  state: SacState,
  playerId: number,
  kind: SacManagementKind,
): number[] {
  const variant = sacVariant(state.variantId);
  return variant.tiles.flatMap((tile, tileIndex) => {
    if (state.ownership[tileIndex] !== playerId) return [];
    const building = buildingAt(state, tileIndex);
    if (kind === 'build') {
      const group = groupFor(variant, tile);
      if (
        !group ||
        building.mortgaged ||
        building.hotel ||
        !ownsGroup(state, playerId, variant, group)
      )
        return [];
      const cost = buildCost(group, building);
      return cost > 0 && state.money[playerId] >= cost ? [tileIndex] : [];
    }
    if (kind === 'sell')
      return building.hotel || building.houses > 0 ? [tileIndex] : [];
    if (kind === 'mortgage')
      return !building.mortgaged && !building.hotel && building.houses === 0
        ? [tileIndex]
        : [];
    const cost = unmortgageCost(variant, tile);
    return building.mortgaged && state.money[playerId] >= cost
      ? [tileIndex]
      : [];
  });
}

function applyManagement(
  state: SacState,
  playerId: number,
  kind: SacManagementKind,
  tileIndex: number,
  ctx: RuleContext,
): void {
  const variant = sacVariant(state.variantId);
  const tile = variant.tiles[tileIndex];
  const building = buildingAt(state, tileIndex);
  if (kind === 'build') {
    const group = groupFor(variant, tile);
    if (!group) return;
    const cost = buildCost(group, building);
    changeMoney(state, playerId, -cost, false, ctx);
    if (building.houses >= 4 && group.hotelPrice > 0) building.hotel = true;
    else building.houses += 1;
  } else if (kind === 'sell') {
    const group = groupFor(variant, tile);
    if (!group) return;
    const value = building.hotel
      ? group.hotelPrice
      : houseCost(group, Math.max(1, building.houses));
    if (building.hotel) building.hotel = false;
    else building.houses -= 1;
    changeMoney(state, playerId, Math.floor(value / 2), false, ctx);
  } else if (kind === 'mortgage') {
    building.mortgaged = true;
    changeMoney(state, playerId, mortgageValue(variant, tile), false, ctx);
  } else {
    building.mortgaged = false;
    changeMoney(state, playerId, -unmortgageCost(variant, tile), false, ctx);
  }
}

function completeTurn(
  state: SacState,
  playerId: number,
  ctx: RuleContext,
): void {
  updateWinner(state, ctx);
  if (
    state.winnerId != null ||
    state.pendingPurchase ||
    state.pendingManagement
  )
    return;
  if (state.extraRoll[playerId] && !state.eliminated[playerId])
    state.extraRoll[playerId] = false;
  else ctx.turn.end();
}
